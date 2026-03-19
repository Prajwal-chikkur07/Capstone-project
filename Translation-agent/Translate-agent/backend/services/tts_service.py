import os
import logging
from gtts import gTTS
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

def text_to_speech_gtts(text: str, language: str = "en") -> str:
    """
    Converts text to speech using Google Text-to-Speech (gTTS).
    Returns the path to the generated audio file.
    
    Args:
        text: The text to convert to speech
        language: Language code (e.g., 'en', 'hi', 'ta', 'bn')
    
    Returns:
        Path to the generated MP3 file
    """
    try:
        logger.info(f"Generating TTS for text: '{text[:50]}...' in language: {language}")
        
        # Create TTS object
        tts = gTTS(text=text, lang=language, slow=False)
        
        # Create temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        temp_path = temp_file.name
        temp_file.close()
        
        # Save audio to temp file
        tts.save(temp_path)
        
        logger.info(f"TTS audio generated successfully: {temp_path}")
        return temp_path
        
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        raise Exception(f"Failed to generate speech: {str(e)}")


def text_to_speech_sarvam(text: str, language: str = "en-IN", speaker_gender: str = "Male") -> str:
    """
    Converts text to speech using Sarvam AI TTS API.
    This is a placeholder for Sarvam AI integration.
    
    Args:
        text: The text to convert to speech
        language: Language code (e.g., 'en-IN', 'hi-IN', 'ta-IN')
        speaker_gender: 'Male' or 'Female'
    
    Returns:
        Path to the generated audio file
    
    Note:
        Requires SARVAM_API_KEY and appropriate API tier.
        Uncomment and implement when Sarvam TTS is available.
    """
    import requests
    from dotenv import load_dotenv
    
    load_dotenv()
    SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
    
    if not SARVAM_API_KEY:
        raise Exception("SARVAM_API_KEY is not set")
    
    url = "https://api.sarvam.ai/text-to-speech"
    
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "input": text,
        "target_language_code": language,
        "speaker": speaker_gender,
        "pitch": 0,
        "pace": 1.0,
        "loudness": 1.5,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v1"
    }
    
    logger.info(f"Calling Sarvam TTS API for language: {language}")
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        # Save audio response to temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_path = temp_file.name
        temp_file.write(response.content)
        temp_file.close()
        
        logger.info(f"Sarvam TTS audio generated: {temp_path}")
        return temp_path
    else:
        logger.error(f"Sarvam TTS API error: {response.status_code} - {response.text}")
        raise Exception(f"Sarvam TTS API Error: {response.status_code} - {response.text}")


# Language code mapping for gTTS
GTTS_LANGUAGE_MAP = {
    "en": "en",
    "en-IN": "en",
    "hi-IN": "hi",
    "bn-IN": "bn",
    "ta-IN": "ta",
    "te-IN": "te",
    "ml-IN": "ml",
    "mr-IN": "mr",
    "gu-IN": "gu",
    "kn-IN": "kn",
    "pa-IN": "pa",
    "or-IN": "or",
}


def get_gtts_language_code(language_code: str) -> str:
    """
    Maps language codes to gTTS compatible codes.
    """
    return GTTS_LANGUAGE_MAP.get(language_code, "en")
