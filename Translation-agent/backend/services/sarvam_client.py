import os
import requests
import logging
from dotenv import load_dotenv
from services.audio_utils import get_audio_duration, split_audio_into_chunks, cleanup_chunks
from services.translation_cache import get_cached, store_translation

load_dotenv()

logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
MAX_AUDIO_DURATION = 25  # Sarvam supports up to 30 seconds, use 25 for safety

def translate_speech_to_text(audio_file_path: str, content_type: str = "audio/wav") -> dict:
    """
    Calls Sarvam AI's speech-to-text-translate API.
    Automatically splits long audio files into chunks if duration > 25 seconds.
    Returns dict: { "transcript": str, "confidence": float | None }
    """
    if not SARVAM_API_KEY:
        raise Exception("SARVAM_API_KEY is not set")
    
    try:
        # Check audio duration
        duration = get_audio_duration(audio_file_path)
        logger.info(f"Audio duration: {duration:.2f} seconds")
        
        # If audio is short enough, process directly
        if duration <= MAX_AUDIO_DURATION:
            return _process_single_audio(audio_file_path, content_type)
        
        # For long audio, split into chunks and process each in parallel
        chunk_paths = split_audio_into_chunks(audio_file_path, chunk_duration_seconds=MAX_AUDIO_DURATION)
        logger.info(f"Audio is longer than {MAX_AUDIO_DURATION}s, splitting into {len(chunk_paths)} chunks...")
        
        from concurrent.futures import ThreadPoolExecutor
        
        try:
            with ThreadPoolExecutor(max_workers=min(len(chunk_paths), 10)) as executor:
                futures = [executor.submit(_process_single_audio, path, "audio/wav") for path in chunk_paths]
                results = [f.result() for f in futures]
            
            full_transcript = " ".join([r["transcript"] for r in results if r.get("transcript")])
            # Average confidence across chunks (ignore None)
            conf_scores = [r["confidence"] for r in results if r.get("confidence") is not None]
            avg_confidence = round(sum(conf_scores) / len(conf_scores), 3) if conf_scores else None
            logger.info(f"Combined transcript from {len(chunk_paths)} chunks (Parallel)")
            return {"transcript": full_transcript, "confidence": avg_confidence}
            
        finally:
            cleanup_chunks(chunk_paths)
            
    except Exception as e:
        logger.error(f"Error in translate_speech_to_text: {e}")
        raise


def _process_single_audio(audio_file_path: str, content_type: str) -> dict:
    """
    Processes a single audio file (must be <= 30 seconds).
    Returns dict with 'transcript' and 'confidence' keys.
    """
    url = "https://api.sarvam.ai/speech-to-text-translate"
    
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
    }
    
    filename = os.path.basename(audio_file_path)
    logger.info(f"Sending audio to Sarvam: file={filename}, content_type={content_type}")

    with open(audio_file_path, "rb") as f:
        files = {"file": (filename, f, content_type)}
        data = {
            "model": "saaras:v2.5",
            "prompt": ""
        }
        response = requests.post(url, headers=headers, files=files, data=data)
    
    logger.info(f"Sarvam STT response: status={response.status_code}, body={response.text[:300]}")
    if response.status_code == 200:
        body = response.json()
        transcript = body.get("transcript", "")
        # Sarvam may return confidence at top level or inside word-level data
        confidence = body.get("confidence", None)
        if confidence is None:
            # Try to derive from word-level confidences if present
            words = body.get("words", [])
            if words:
                scores = [w.get("confidence", 1.0) for w in words if "confidence" in w]
                confidence = round(sum(scores) / len(scores), 3) if scores else None
        return {"transcript": transcript, "confidence": confidence}
    else:
        raise Exception(f"Sarvam API Error: {response.status_code} - {response.text}")

def translate_text(text: str, source_language: str, target_language: str) -> str:
    """
    Translates text to the target language.
    Checks the semantic cache first — only calls Sarvam on a cache miss.
    Falls back to HuggingFace if Sarvam fails.
    """
    # ── Layer 1 & 2: cache lookup ─────────────────────────────────────────
    cached = get_cached(text, target_language)
    if cached:
        return cached

    # ── Cache miss: try Sarvam first ──────────────────────────────────────
    if SARVAM_API_KEY:
        try:
            url = "https://api.sarvam.ai/translate"
            payload = {
                "input": text,
                "source_language_code": source_language,
                "target_language_code": target_language,
                "speaker_gender": "Male",
                "mode": "formal",
                "model": "mayura:v1",
                "enable_preprocessing": True,
            }
            headers = {
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            }
            logger.info(f"Sarvam translate: src={source_language}, tgt={target_language}, text='{text[:80]}'")
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            logger.info(f"Sarvam response: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                if "translated_text" in data:
                    result = data["translated_text"]
                elif "translations" in data:
                    r = data["translations"]
                    result = r[0] if isinstance(r, list) else r
                elif "translation" in data:
                    result = data["translation"]
                else:
                    raise Exception(f"Unexpected Sarvam response: {data}")
                store_translation(text, target_language, result)
                return result
            else:
                logger.warning(f"Sarvam failed ({response.status_code}), falling back to HuggingFace")
        except Exception as e:
            logger.warning(f"Sarvam error: {e}, falling back to HuggingFace")

    # ── Fallback: HuggingFace ─────────────────────────────────────────────
    try:
        from services.huggingface_client import translate_text_hf
        logger.info(f"Using HuggingFace fallback for {target_language}")
        result = translate_text_hf(text, target_language)
        store_translation(text, target_language, result)
        return result
    except Exception as e:
        logger.error(f"HuggingFace fallback also failed: {e}")
        raise Exception(f"Translation failed: both Sarvam and HuggingFace unavailable. {e}")
