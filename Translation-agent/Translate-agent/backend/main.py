import os
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import aiofiles

from services.sarvam_client import translate_speech_to_text, translate_text
from services.gemini_client import rewrite_text_tone
from services.tts_service import text_to_speech_gtts, get_gtts_language_code
from services.email_service import send_email, format_email_body
from services.slack_service import send_to_slack, format_slack_message
from services.linkedin_service import share_to_linkedin, format_linkedin_post, mock_linkedin_share

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Voice Translation Backend")

# Configuration for file uploads
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB (supports up to 5 min audio)
CHUNK_SIZE = 1024 * 1024  # 1MB chunks

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    text: str
    target_language: str

class RewriteRequest(BaseModel):
    text: str
    tone: str
    user_override: str | None = None

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    use_sarvam: bool = False
    speaker: str = "meera"  # sarvam speaker: meera, pavithra, maitreyi, arvind, amol, amartya, etc.

class EmailRequest(BaseModel):
    text: str
    to_email: str
    subject: str = "Message from Voice Translation App"
    tone: str | None = None
    language: str | None = None
    use_sendgrid: bool = False
    smtp_username: str | None = None   # sender email from frontend
    smtp_password: str | None = None   # app password from frontend

class SlackRequest(BaseModel):
    text: str
    webhook_url: str | None = None
    channel: str | None = None
    tone: str | None = None
    language: str | None = None
    use_api: bool = False

class LinkedInRequest(BaseModel):
    text: str
    tone: str | None = None
    language: str | None = None
    add_hashtags: bool = True
    access_token: str | None = None
    person_urn: str | None = None
    use_mock: bool = True  # Use mock by default until OAuth is configured

@app.post("/api/translate-audio")
async def handle_audio_translation(file: UploadFile = File(...)):
    """
    Receives audio in local language, translates to English using Sarvam.
    Supports larger files and efficient chunked streaming.
    Supported formats: webm, wav, mp3, ogg, flac, m4a
    """
    logger = logging.getLogger(__name__)
    original_filename = file.filename or "recording.webm"
    
    # Validate file size
    file_size = 0
    content_type = file.content_type or "audio/webm"
    
    # Map content types based on file extension
    if content_type == "application/octet-stream":
        if original_filename.endswith(".webm"):
            content_type = "audio/webm"
        elif original_filename.endswith(".wav"):
            content_type = "audio/wav"
        elif original_filename.endswith(".mp3"):
            content_type = "audio/mpeg"
        elif original_filename.endswith(".m4a"):
            content_type = "audio/x-m4a"
        elif original_filename.endswith(".ogg"):
            content_type = "audio/ogg"
        elif original_filename.endswith(".flac"):
            content_type = "audio/flac"
        else:
            content_type = "audio/webm"

    logger.info(f"Received audio: filename={original_filename}, content_type={content_type}")

    # Create temp directory if it doesn't exist
    os.makedirs("temp_audio", exist_ok=True)
    temp_path = f"temp_audio/temp_{original_filename}"
    
    try:
        # Stream file to disk in chunks to handle large files efficiently
        async with aiofiles.open(temp_path, "wb") as buffer:
            while chunk := await file.read(CHUNK_SIZE):
                file_size += len(chunk)
                
                # Check file size limit
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024)}MB"
                    )
                
                await buffer.write(chunk)
        
        logger.info(f"File saved successfully: {temp_path}, size: {file_size / 1024:.2f}KB")
        
        # Translate audio to text
        english_transcript = translate_speech_to_text(temp_path, content_type=content_type)

        if not english_transcript or not english_transcript.strip():
            raise HTTPException(status_code=422, detail="Could not transcribe audio. Please speak clearly and try again.")
        
        return {
            "transcript": english_transcript,
            "file_size": file_size,
            "filename": original_filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"translate-audio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/rewrite-tone")
async def handle_tone_rewrite(request: RewriteRequest):
    """
    Rewrites the english text with Google Gemini based on the selected tone.
    """
    try:
        rewritten_text = rewrite_text_tone(
            text=request.text,
            tone_option=request.tone,
            user_override=request.user_override
        )
        return {"rewritten_text": rewritten_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translate-text")
async def handle_text_translation(request: TranslationRequest):
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        native_translation = translate_text(
            text=request.text, 
            source_language="en-IN", 
            target_language=request.target_language
        )
        return {"translated_text": native_translation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-speech")
async def handle_text_to_speech(request: TTSRequest):
    """
    Converts text to speech and returns an audio file.
    Uses gTTS (Google Text-to-Speech) by default.
    Set use_sarvam=true to use Sarvam AI TTS (if available in your tier).
    
    Supported languages:
    - en, en-IN: English
    - hi-IN: Hindi
    - bn-IN: Bengali
    - ta-IN: Tamil
    - te-IN: Telugu
    - ml-IN: Malayalam
    - mr-IN: Marathi
    - gu-IN: Gujarati
    - kn-IN: Kannada
    - pa-IN: Punjabi
    - or-IN: Odia
    """
    logger = logging.getLogger(__name__)
    
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if len(request.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long. Maximum 5000 characters.")
    
    temp_audio_path = None
    
    try:
        logger.info(f"TTS request: language={request.language}, use_sarvam={request.use_sarvam}, speaker={request.speaker}")
        
        if request.use_sarvam:
            from services.tts_service import text_to_speech_sarvam
            temp_audio_path = text_to_speech_sarvam(
                text=request.text,
                language=request.language,
                speaker_gender=request.speaker
            )
            logger.info(f"Sarvam TTS succeeded with speaker={request.speaker}")
        else:
            gtts_lang = get_gtts_language_code(request.language)
            temp_audio_path = text_to_speech_gtts(request.text, gtts_lang)
        
        # Return the audio file
        return FileResponse(
            path=temp_audio_path,
            media_type="audio/wav" if request.use_sarvam else "audio/mpeg",
            filename="speech.wav" if request.use_sarvam else "speech.mp3",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {e}")
        # Clean up temp file if it exists
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/send/email")
async def handle_send_email(request: EmailRequest):
    """
    Sends the translated text via email.
    
    Configuration:
    - SMTP (Gmail, Outlook, etc.):
      Set SMTP_USERNAME, SMTP_PASSWORD in .env
      For Gmail, use App Password: https://myaccount.google.com/apppasswords
    
    - SendGrid (optional):
      Set SENDGRID_API_KEY in .env
      Get API key: https://app.sendgrid.com/settings/api_keys
    
    Request body:
    - text: The message content
    - to_email: Recipient email address
    - subject: Email subject (optional)
    - tone: Tone style used (optional, for metadata)
    - language: Language (optional, for metadata)
    - use_sendgrid: Use SendGrid instead of SMTP (optional)
    """
    logger = logging.getLogger(__name__)
    
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if not request.to_email or "@" not in request.to_email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    try:
        logger.info(f"Sending email to {request.to_email}")
        
        # Format email body
        plain_text, html_body = format_email_body(
            request.text,
            tone=request.tone,
            language=request.language
        )
        
        # Send email
        result = send_email(
            to_email=request.to_email,
            subject=request.subject,
            body=plain_text,
            html_body=html_body,
            use_sendgrid=request.use_sendgrid,
            smtp_username=request.smtp_username,
            smtp_password=request.smtp_password,
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/send/slack")
async def handle_send_slack(request: SlackRequest):
    """
    Sends the translated text to Slack.
    
    Configuration:
    - Webhook (recommended for simple use):
      Set SLACK_WEBHOOK_URL in .env
      Get webhook: https://api.slack.com/apps → Your App → Incoming Webhooks
    
    - API (for advanced use):
      Set SLACK_BOT_TOKEN in .env
      Get token: https://api.slack.com/apps → Your App → OAuth & Permissions
      Requires "chat:write" scope
    
    Request body:
    - text: The message content
    - webhook_url: Slack webhook URL (optional if set in .env)
    - channel: Channel name or ID (optional, for API method)
    - tone: Tone style used (optional, for metadata)
    - language: Language (optional, for metadata)
    - use_api: Use Slack API instead of webhook (optional)
    """
    logger = logging.getLogger(__name__)
    
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        logger.info("Sending message to Slack")
        
        # Format message for Slack
        formatted_text = format_slack_message(
            request.text,
            tone=request.tone,
            language=request.language
        )
        
        # Send to Slack
        result = send_to_slack(
            text=formatted_text,
            channel=request.channel,
            webhook_url=request.webhook_url,
            use_api=request.use_api
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Slack send error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/send/linkedin")
async def handle_send_linkedin(request: LinkedInRequest):
    """
    Shares the translated text to LinkedIn.
    
    Configuration:
    LinkedIn requires OAuth 2.0 authentication. This is a placeholder implementation.
    
    For production use:
    1. Create LinkedIn App: https://www.linkedin.com/developers/apps
    2. Add "Share on LinkedIn" product
    3. Request "w_member_social" permission
    4. Implement OAuth flow to get access token
    5. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in .env
    
    For testing:
    - Set use_mock=true to simulate posting without OAuth
    
    Request body:
    - text: The post content
    - tone: Tone style used (optional, for metadata)
    - language: Language (optional, for metadata)
    - add_hashtags: Add relevant hashtags (optional, default: true)
    - access_token: LinkedIn access token (optional if set in .env)
    - person_urn: LinkedIn person URN (optional if set in .env)
    - use_mock: Use mock mode for testing (optional, default: true)
    """
    logger = logging.getLogger(__name__)
    
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        logger.info("Sharing post to LinkedIn")
        
        # Format post for LinkedIn
        formatted_text = format_linkedin_post(
            request.text,
            tone=request.tone,
            language=request.language,
            add_hashtags=request.add_hashtags
        )
        
        # Share to LinkedIn
        if request.use_mock:
            result = mock_linkedin_share(formatted_text)
        else:
            result = share_to_linkedin(
                text=formatted_text,
                access_token=request.access_token,
                person_urn=request.person_urn
            )
        
        return result
        
    except Exception as e:
        logger.error(f"LinkedIn share error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
