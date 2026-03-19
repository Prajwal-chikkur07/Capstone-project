import os
import logging
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def rewrite_text_tone(text: str, tone_option: str, user_override: str = None) -> str:
    """
    Uses Google Gemini to rewrite the text into the specified tone.
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set")
    
    tone_descriptions = {
        "Email Formal": "Professional language, complete sentences, proper salutations.",
        "Email Casual": "Friendly but professional, conversational.",
        "Slack": "Casual, conversational, short messages, emoji support.",
        "LinkedIn": "Thought leadership tone, engaging/polished, hashtag suggestions.",
        "WhatsApp Business": "Short, clear, professional, direct, often starts with a friendly greeting, uses bullet points for clarity."
    }
    
    if user_override:
        tone_instruction = f"Use the following custom tone requested by the user: '{user_override}'"
    else:
        description = tone_descriptions.get(tone_option, "Neutral tone.")
        tone_instruction = f"Tone style: {tone_option} ({description})"
        
    prompt = f"""
    Please rewrite the following translated text to match the requested style.
    
    {tone_instruction}
    
    Original text: "{text}"
    
    Rewritten text:"""
    
    logger.info(f"Gemini rewrite request: tone='{tone_option}', text='{text[:80]}'")
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    try:
        response = model.generate_content(prompt)
        logger.info(f"Gemini rewrite response received.")
        return response.text.strip()
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Gemini API Error: {error_msg}")
        
        # Check for quota exceeded error
        if "quota" in error_msg.lower() or "exceeded" in error_msg.lower():
            logger.warning("Gemini API quota exceeded - returning original text with note")
            return f"{text}\n\n[Note: Tone rewriting unavailable - API quota exceeded. Please check your Gemini API billing at https://aistudio.google.com/]"
        
        # Check if it was a safety filter or other specific issue
        if hasattr(e, 'message'):
            raise Exception(f"Gemini error: {e.message}")
        raise e
