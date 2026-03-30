import os
import logging
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import aiofiles
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from services.sarvam_client import translate_speech_to_text, translate_text
from services.gemini_client import rewrite_text_tone, analyze_sentiment, suggest_tone, summarize_transcript, generate_meeting_notes, answer_question, back_translate_check, get_readability_score, get_tone_confidence, vision_translate_image
from services.tts_service import text_to_speech_gtts, get_gtts_language_code
from services.email_service import send_email, format_email_body
from services.slack_service import send_to_slack, format_slack_message, handle_n2e_command
from services.linkedin_service import share_to_linkedin, format_linkedin_post, mock_linkedin_share
from services.translation_cache import get_stats, clear_cache
from routers.auth_router import router as auth_router
from routers.video_router import router as video_router
from database import init_db

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Voice Translation Backend")

# ── Auth routes ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(video_router)

# ── Create PostgreSQL tables on startup ───────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()

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
    source_language: str = "en-IN"
    target_language: str

class RewriteRequest(BaseModel):
    text: str
    tone: str
    user_override: Optional[str] = None
    custom_vocabulary: Optional[list] = None

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    use_sarvam: bool = False
    speaker: str = "meera"  # sarvam speaker: meera, pavithra, maitreyi, arvind, amol, amartya, etc.

class EmailRequest(BaseModel):
    text: str
    to_email: str
    subject: str = "Message from Voice Translation App"
    tone: Optional[str] = None
    language: Optional[str] = None
    use_sendgrid: bool = False
    smtp_username: Optional[str] = None   # sender email from frontend
    smtp_password: Optional[str] = None   # app password from frontend

class SlackRequest(BaseModel):
    text: str
    webhook_url: Optional[str] = None
    channel: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    use_api: bool = False

class SlackN2ERequest(BaseModel):
    """Unified Slack /n2e translation request (handles both text and voice)"""
    command: str = "/n2e"  # Always "/n2e"
    text: Optional[str] = None  # Text to translate (optional)
    file_url: Optional[str] = None  # Audio file URL from Slack (optional)
    user_id: Optional[str] = None
    team_id: Optional[str] = None
    channel_id: Optional[str] = None
    response_url: Optional[str] = None
    bot_token: Optional[str] = None
    source_language: str = "en-IN"  # default source language
    target_language: str = "en"  # default target language

class LinkedInRequest(BaseModel):
    text: str
    tone: Optional[str] = None
    language: Optional[str] = None
    add_hashtags: bool = True
    access_token: Optional[str] = None
    person_urn: Optional[str] = None
    use_mock: bool = True  # Use mock by default until OAuth is configured

@app.post("/api/translate-audio")
async def handle_audio_translation(file: UploadFile = File(...)):
    """
    Receives audio in local language, translates to English using Sarvam.
    Also returns diarized_transcript if available (speaker segments).
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
        
        # Translate audio to text — returns { transcript, confidence }
        result = translate_speech_to_text(temp_path, content_type=content_type)
        english_transcript = result.get("transcript", "")
        confidence = result.get("confidence", None)

        if not english_transcript or not english_transcript.strip():
            raise HTTPException(status_code=422, detail="Could not transcribe audio. Please speak clearly and try again.")
        
        return {
            "transcript": english_transcript,
            "confidence": confidence,
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

@app.post("/api/diarize-audio")
async def handle_diarize_audio(file: UploadFile = File(...), speaker_count: int = Form(0)):
    """
    Transcribe audio with speaker diarization.
    speaker_count: hint from user (0 = auto-detect, 2-5 = exact count)
    """
    logger = logging.getLogger(__name__)
    original_filename = file.filename or "recording.webm"
    content_type = file.content_type or "audio/webm"

    os.makedirs("temp_audio", exist_ok=True)
    temp_path = f"temp_audio/diarize_{original_filename}"

    try:
        async with aiofiles.open(temp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                await f.write(chunk)

        # Step 1: Get full transcript via Sarvam (most accurate for Indian languages)
        from services.sarvam_client import translate_speech_to_text
        try:
            stt = translate_speech_to_text(temp_path, content_type=content_type)
            full_transcript = stt.get("transcript", "").strip()
        except Exception as sarvam_err:
            logger.warning(f"[diarize] Sarvam failed: {sarvam_err}, trying HuggingFace Whisper")
            # Fallback: HuggingFace Whisper
            HF_KEY = os.getenv("HUGGINGFACE_API_KEY")
            if not HF_KEY:
                raise HTTPException(status_code=500, detail="Both Sarvam and HuggingFace unavailable")
            import requests as req
            with open(temp_path, "rb") as f:
                audio_bytes = f.read()
            resp = req.post(
                "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
                headers={"Authorization": f"Bearer {HF_KEY}"},
                data=audio_bytes,
                timeout=60,
            )
            if resp.status_code == 503:
                import time; time.sleep(10)
                resp = req.post(
                    "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
                    headers={"Authorization": f"Bearer {HF_KEY}"},
                    data=audio_bytes,
                    timeout=60,
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Whisper failed: {resp.text[:200]}")
            full_transcript = resp.json().get("text", "").strip()

        if not full_transcript:
            raise HTTPException(status_code=422, detail="Could not transcribe audio")

        # Step 2: Real audio-based speaker diarization
        from services.audio_diarization import diarize_audio_file
        segments_raw = diarize_audio_file(temp_path, full_transcript)
        method = "audio"

        # Fallback to Gemini text-based if audio diarization failed
        if not segments_raw:
            logger.warning("[diarize] Audio diarization returned no segments, falling back to Gemini text split")
            method = "gemini"
            GEMINI_KEY = os.getenv("GEMINI_API_KEY")
            segments_raw = []

            if GEMINI_KEY:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=GEMINI_KEY)
                    model = genai.GenerativeModel("gemini-2.0-flash")

                    if speaker_count >= 2:
                        speaker_instruction = (
                            f"IMPORTANT: There are EXACTLY {speaker_count} speakers. "
                            f"You MUST use exactly {speaker_count} different people: "
                            f"{', '.join([f'Person {i+1}' for i in range(speaker_count)])}."
                        )
                    else:
                        speaker_instruction = "Identify how many distinct speakers there are (2 to 5)."

                    prompt = f"""You are an expert conversation analyst.

{speaker_instruction}

Split this transcript into individual speaker turns.
- Every sentence belongs to exactly one speaker
- Short responses like "yes", "okay" are often a different speaker
- Questions are usually answered by a different speaker
- Detect emotion per segment: happy, neutral, serious, sad, angry, excited
- Return ONLY a valid JSON array

Format:
[
  {{"speaker": "Person 1", "text": "...", "emotion": "neutral"}},
  {{"speaker": "Person 2", "text": "...", "emotion": "happy"}}
]

Transcript:
{full_transcript}"""

                    resp = model.generate_content(prompt)
                    raw  = resp.text.strip()
                    if raw.startswith("```"):
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                    import json
                    parsed = json.loads(raw.strip())
                    if isinstance(parsed, list) and parsed:
                        for seg in parsed:
                            sp  = str(seg.get("speaker", "Person 1")).strip()
                            num = int(''.join(filter(str.isdigit, sp)) or "1")
                            num = min(num, 5)
                            segments_raw.append({
                                "speaker": f"Person {num}",
                                "text":    str(seg.get("text", "")).strip(),
                                "emotion": str(seg.get("emotion", "neutral")).lower(),
                                "gender":  "male",
                            })
                        segments_raw = [s for s in segments_raw if s["text"]]
                except Exception as e:
                    logger.warning(f"[diarize] Gemini fallback failed: {e}")

        # Last resort: sentence split
        if not segments_raw:
            method = "fallback"
            import re
            n_sp = max(2, min(5, speaker_count if speaker_count >= 2 else 2))
            sentences = re.split(r'(?<=[.!?])\s+', full_transcript)
            sentences = [s.strip() for s in sentences if s.strip()]
            for i, sent in enumerate(sentences):
                segments_raw.append({
                    "speaker": f"Person {(i % n_sp) + 1}",
                    "text":    sent,
                    "emotion": "neutral",
                    "gender":  "male" if i % 2 == 0 else "female",
                })

        # Assign voices if not already set by audio diarization
        from services.diarization_service import assign_speaker_voices
        for seg in segments_raw:
            if "voice" not in seg:
                seg["voice"] = {}
        segments = assign_speaker_voices(segments_raw)

        # Compute per-speaker confidence based on segment count consistency
        speaker_counts = {}
        for s in segments:
            speaker_counts[s["speaker"]] = speaker_counts.get(s["speaker"], 0) + 1
        total = len(segments)
        for s in segments:
            # Confidence: more segments = more confident attribution
            count = speaker_counts[s["speaker"]]
            s["confidence"] = round(min(0.95, 0.6 + (count / total) * 0.35), 2)

        return {
            "transcript":   full_transcript,
            "segments":     segments,
            "speaker_count": len(set(s["speaker"] for s in segments)),
            "method":       method,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"diarize-audio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/synthesize-conversation")
async def handle_synthesize_conversation(request: dict):
    """
    Generate TTS audio for each speaker segment in the target language.
    Returns base64 audio per segment.
    """
    import base64
    segments = request.get("segments", [])
    target_language = request.get("target_language", "hi-IN")
    results = []

    from services.tts_service import text_to_speech_sarvam, text_to_speech_gtts, get_gtts_language_code

    for seg in segments:
        translated_text = seg.get("translated_text") or seg.get("text", "")
        emotion = seg.get("emotion", "neutral")
        voice_info = seg.get("voice", {})
        speaker = voice_info.get("sarvam", "anushka")
        gender = voice_info.get("gtts_gender", "female")

        audio_path = None
        try:
            audio_path = text_to_speech_sarvam(translated_text, target_language, speaker)
        except Exception:
            try:
                gtts_lang = get_gtts_language_code(target_language)
                audio_path = text_to_speech_gtts(translated_text, gtts_lang, emotion=emotion, gender=gender)
            except Exception as e:
                results.append({"speaker": seg.get("speaker"), "error": str(e)})
                continue

        if audio_path and os.path.exists(audio_path):
            with open(audio_path, "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode()
            os.remove(audio_path)
            results.append({
                "speaker": seg.get("speaker"),
                "audio": audio_b64,
                "emotion": emotion,
            })

    return {"segments": results}


@app.post("/api/rewrite-tone")
async def handle_tone_rewrite(request: RewriteRequest):
    """
    Rewrites the english text with Google Gemini based on the selected tone.
    """
    try:
        rewritten_text = rewrite_text_tone(
            text=request.text,
            tone_option=request.tone,
            user_override=request.user_override,
            custom_vocabulary=request.custom_vocabulary,
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
            source_language=request.source_language,
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

@app.get("/api/health")
async def health_check():
    """Lightweight health check — always returns immediately."""
    return {"status": "ok"}


@app.get("/api/cache/stats")
async def handle_cache_stats():
    """Returns translation cache statistics — total entries, hits, breakdown by language."""
    return get_stats()


@app.delete("/api/cache/clear")
async def handle_cache_clear(lang: Optional[str] = None):
    """
    Clears the translation cache.
    Pass ?lang=hi-IN to clear only one language, or no param to clear all.
    """
    deleted = clear_cache(lang)
    return {"status": "cleared", "deleted": deleted, "lang": lang or "all"}


class SentimentRequest(BaseModel):
    text: str

class ToneSuggestRequest(BaseModel):
    text: str

class SummarizeRequest(BaseModel):
    text: str

class MeetingNotesRequest(BaseModel):
    text: str

class QARequest(BaseModel):
    transcript: str
    question: str

class ShareLinkRequest(BaseModel):
    text: str
    title: str = ""

class ExportRequest(BaseModel):
    entries: list
    format: str = "csv"  # csv or txt

@app.post("/api/analyze-sentiment")
async def handle_sentiment(request: SentimentRequest):
    """Returns sentiment analysis: positive/neutral/negative with score and summary."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return analyze_sentiment(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/suggest-tone")
async def handle_suggest_tone(request: ToneSuggestRequest):
    """Returns the best tone for the given text."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        tone = suggest_tone(request.text)
        return {"suggested_tone": tone}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/export")
async def handle_export(request: ExportRequest):
    """Exports history entries as CSV or plain text."""
    import io, csv
    from fastapi.responses import StreamingResponse
    if request.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Language", "Confidence", "Transcript"])
        for e in request.entries:
            conf = f"{round(e.get('confidence', 0) * 100)}%" if e.get('confidence') else "N/A"
            writer.writerow([e.get("timestamp", ""), e.get("lang", ""), conf, e.get("text", "")])
        output.seek(0)
        return StreamingResponse(io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transcripts.csv"})
    else:
        lines = []
        for e in request.entries:
            lines.append(f"[{e.get('timestamp','')}] ({e.get('lang','')})")
            lines.append(e.get("text", ""))
            lines.append("")
        content = "\n".join(lines)
        return StreamingResponse(io.BytesIO(content.encode()),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=transcripts.txt"})


# ── In-memory share link store (UUID → {text, title, created_at}) ──
import uuid, time
_share_store: dict = {}

@app.post("/api/share/create")
async def create_share_link(request: ShareLinkRequest):
    """Creates a shareable read-only link for a transcript/message."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    link_id = str(uuid.uuid4())[:8]
    _share_store[link_id] = {"text": request.text, "title": request.title, "created_at": time.time()}
    return {"link_id": link_id, "url": f"/share/{link_id}"}

@app.get("/api/share/{link_id}")
async def get_share_link(link_id: str):
    """Returns the shared content for a given link ID."""
    item = _share_store.get(link_id)
    if not item:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    return item

@app.post("/api/summarize")
async def handle_summarize(request: SummarizeRequest):
    """Returns a 2-3 sentence TL;DR of the transcript."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return {"summary": summarize_transcript(request.text)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/meeting-notes")
async def handle_meeting_notes(request: MeetingNotesRequest):
    """Returns structured meeting notes from a transcript."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return generate_meeting_notes(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/qa")
async def handle_qa(request: QARequest):
    """Answers a question about the transcript."""
    if not request.transcript.strip() or not request.question.strip():
        raise HTTPException(status_code=400, detail="Transcript and question are required")
    try:
        return {"answer": answer_question(request.transcript, request.question)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BackTranslateRequest(BaseModel):
    text: str
    source_lang: str = "hi-IN"

class ReadabilityRequest(BaseModel):
    text: str

class ToneConfidenceRequest(BaseModel):
    text: str
    tone: str

class MultiTranslateRequest(BaseModel):
    text: str
    languages: list  # list of lang codes

@app.post("/api/back-translate")
async def handle_back_translate(request: BackTranslateRequest):
    """Translates native text back to English and rates accuracy."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return back_translate_check(request.text, request.source_lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/readability")
async def handle_readability(request: ReadabilityRequest):
    """Returns Flesch-Kincaid readability score for the given text."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    return get_readability_score(request.text)

@app.post("/api/tone-confidence")
async def handle_tone_confidence(request: ToneConfidenceRequest):
    """Rates how well the rewritten text matches the intended tone."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return get_tone_confidence(request.text, request.tone)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/multi-translate")
async def handle_multi_translate(request: MultiTranslateRequest):
    """Translates text into multiple languages simultaneously."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if not request.languages:
        raise HTTPException(status_code=400, detail="At least one language required")
    results = {}
    for lang in request.languages[:5]:  # cap at 5
        try:
            results[lang] = translate_text(request.text, source_language="en-IN", target_language=lang)
        except Exception as e:
            results[lang] = f"[Error: {str(e)[:60]}]"
    return {"translations": results}


@app.post("/api/vision-translate")
async def handle_vision_translate(
    file: UploadFile = File(...),
    target_language: str = Form("hi-IN"),
):
    """
    Accepts an image (PNG/JPG/WEBP), detects all text regions using Gemini Vision,
    translates each region to target_language, and returns bounding box + translated text.
    """
    logger = logging.getLogger(__name__)

    ALLOWED_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {content_type}. Use PNG, JPG, or WEBP.")

    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Maximum 10MB.")

    logger.info(f"Vision translate: {file.filename}, {len(image_bytes)} bytes → {target_language}")

    try:
        regions = vision_translate_image(image_bytes, content_type, target_language)
        return {"regions": regions, "count": len(regions)}
    except Exception as e:
        logger.error(f"Vision translate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/slack/n2e")
async def handle_slack_n2e(request: SlackN2ERequest):
    """
    Unified Slack slash command handler for /n2e.
    
    Handles BOTH text and voice translation:
    - **Text Translation:** /n2e <text>
    - **Voice Translation:** Upload audio, then /n2e
    
    Slack setup for /n2e:
    1. Go to https://api.slack.com/apps
    2. Create a new app or select existing
    3. Go to "Slash Commands" and create a new command
    4. Set request URL to: https://your-backend-url/api/slack/n2e
    5. Set the command to: /n2e
    6. Set short description: "Translate text or voice to any language"
    7. Add scopes: chat:write, commands, files:read
    8. Reinstall the app to your workspace
    
    Usage Examples:
    - Text: /n2e Hello, how are you?
    - Voice: [Upload audio] → /n2e
    
    Request Format:
    {
        "command": "/n2e",
        "text": "optional text input",
        "file_url": "optional file url from slack",
        "source_language": "en-IN",
        "target_language": "en"
    }
    """
    logger = logging.getLogger(__name__)
    
    # Validate that at least one input is provided
    if not request.text and not request.file_url:
        raise HTTPException(
            status_code=400, 
            detail="Please provide either text or upload an audio file"
        )
    
    try:
        logger.info(f"Slack /n2e command: text={'provided' if request.text else 'None'}, file_url={'provided' if request.file_url else 'None'}")
        
        # Call the unified handler
        response = handle_n2e_command(
            text=request.text,
            file_url=request.file_url,
            source_language=request.source_language,
            target_language=request.target_language
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Slack /n2e command error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/slack/n2e/voice")
async def handle_n2e_voice(
    audio: UploadFile = File(...),
    source_language: str = "en-IN",
    target_language: str = "en"
):
    """
    Push-to-talk endpoint for /n2e command via React frontend.
    
    Receives voice audio, translates speech-to-text and then to target language.
    
    Args:
        audio: Audio file from microphone (webm, wav, mp3, etc.)
        source_language: Source language (default: en-IN)
        target_language: Target language (default: en)
    
    Returns:
        {
            "transcript": "transcribed text",
            "translation": "translated text",
            "source_language": "en-IN",
            "target_language": "en"
        }
    """
    logger = logging.getLogger(__name__)
    
    original_filename = audio.filename or "recording.webm"
    content_type = audio.content_type or "audio/webm"
    
    # Map content types
    if content_type == "application/octet-stream":
        if original_filename.endswith(".webm"):
            content_type = "audio/webm"
        elif original_filename.endswith(".wav"):
            content_type = "audio/wav"
        elif original_filename.endswith(".mp3"):
            content_type = "audio/mpeg"
        else:
            content_type = "audio/webm"
    
    logger.info(f"Push-to-talk: {original_filename}, {source_language} → {target_language}")
    
    os.makedirs("temp_audio", exist_ok=True)
    temp_path = f"temp_audio/push2talk_{original_filename}"
    
    try:
        # Save audio file
        file_size = 0
        async with aiofiles.open(temp_path, "wb") as buffer:
            while chunk := await audio.read(CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024)}MB"
                    )
                await buffer.write(chunk)
        
        logger.info(f"Push-to-talk audio saved: {temp_path} ({file_size / 1024:.2f}KB)")
        
        # Step 1: Speech to text
        stt_result = translate_speech_to_text(temp_path, content_type=content_type)
        transcript = stt_result.get("transcript", "").strip()
        
        if not transcript:
            raise HTTPException(status_code=400, detail="Could not transcribe audio. Please try again.")
        
        logger.info(f"Transcript: {transcript}")
        
        # Step 2: Translate text
        translation_result = translate_text(transcript, source_language, target_language)
        translation = translation_result.get("translated_text", "").strip()
        
        if not translation:
            raise HTTPException(status_code=500, detail="Translation failed. Please try again.")
        
        logger.info(f"Translation: {translation}")
        
        return {
            "transcript": transcript,
            "translation": translation,
            "source_language": source_language,
            "target_language": target_language,
            "response_type": "in_channel"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Push-to-talk error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        # Cleanup
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
