import os
import requests
import logging
from dotenv import load_dotenv
from services.audio_utils import get_audio_duration, split_audio_into_chunks, cleanup_chunks

load_dotenv()

logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
MAX_AUDIO_DURATION = 25  # Sarvam supports up to 30 seconds, use 25 for safety

def translate_speech_to_text(audio_file_path: str, content_type: str = "audio/wav") -> str:
    """
    Calls Sarvam AI's speech-to-text-translate API.
    Automatically splits long audio files into chunks if duration > 25 seconds.
    content_type must be one of the MIME types Sarvam accepts.
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
        logger.info(f"Audio is longer than {MAX_AUDIO_DURATION}s, splitting into {len(split_audio_into_chunks(audio_file_path, MAX_AUDIO_DURATION))} chunks...")
        chunk_paths = split_audio_into_chunks(audio_file_path, chunk_duration_seconds=MAX_AUDIO_DURATION)
        
        from concurrent.futures import ThreadPoolExecutor
        
        try:
            # Use ThreadPoolExecutor to process chunks in parallel
            with ThreadPoolExecutor(max_workers=min(len(chunk_paths), 10)) as executor:
                # Map chunks to the processing function
                # We use a lambda to fix the content_type to "audio/wav" since chunks are WAV
                futures = [executor.submit(_process_single_audio, path, "audio/wav") for path in chunk_paths]
                
                # Wait for all chunks to finish and collect results in order
                transcripts = [f.result() for f in futures]
            
            # Combine all transcripts
            full_transcript = " ".join([t for t in transcripts if t])
            logger.info(f"Combined transcript from {len(chunk_paths)} chunks (Parallel)")
            return full_transcript
            
        finally:
            # Clean up chunk files
            cleanup_chunks(chunk_paths)
            
    except Exception as e:
        logger.error(f"Error in translate_speech_to_text: {e}")
        raise


def _process_single_audio(audio_file_path: str, content_type: str) -> str:
    """
    Processes a single audio file (must be <= 30 seconds).
    Internal function used by translate_speech_to_text.
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
        return response.json().get("transcript", "")
    else:
        raise Exception(f"Sarvam API Error: {response.status_code} - {response.text}")

def translate_text(text: str, source_language: str, target_language: str) -> str:
    """
    Calls Sarvam AI's translate API.
    """
    if not SARVAM_API_KEY:
        raise Exception("SARVAM_API_KEY is not set")
        
    url = "https://api.sarvam.ai/translate"
    
    payload = {
        "input": text,
        "source_language_code": source_language,
        "target_language_code": target_language,
        "speaker_gender": "Male",
        "mode": "formal",
        "model": "mayura:v1",
        "enable_preprocessing": True
    }
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }

    logger.info(f"Sarvam translate request: src={source_language}, tgt={target_language}, text='{text[:80]}'")
    response = requests.post(url, json=payload, headers=headers)
    logger.info(f"Sarvam translate response: status={response.status_code}, body={response.text[:300]}")

    if response.status_code == 200:
        data = response.json()
        # Sarvam /translate endpoint returns key "translated_text"
        if "translated_text" in data:
            return data["translated_text"]
        elif "translations" in data:
            result = data["translations"]
            return result[0] if isinstance(result, list) else result
        elif "translation" in data:
            return data["translation"]
        else:
            raise Exception(f"Unexpected Sarvam response format: {data}")
    else:
        raise Exception(f"Sarvam API Error: {response.status_code} - {response.text}")
