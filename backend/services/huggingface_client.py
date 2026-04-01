import os
import requests
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")
logger = logging.getLogger(__name__)

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_BASE = "https://api-inference.huggingface.co/models"

# Helsinki-NLP models for English → Indian languages
# These are the best available free translation models on HF
HF_TRANSLATION_MODELS = {
    "hi-IN": "Helsinki-NLP/opus-mt-en-hi",
    "bn-IN": "Helsinki-NLP/opus-mt-en-bn",
    "ta-IN": "Helsinki-NLP/opus-mt-en-ta",
    "te-IN": "Helsinki-NLP/opus-mt-en-te",
    "ml-IN": "Helsinki-NLP/opus-mt-en-ml",
    "mr-IN": "Helsinki-NLP/opus-mt-en-mr",
    "gu-IN": "Helsinki-NLP/opus-mt-en-gu",
    "kn-IN": "Helsinki-NLP/opus-mt-en-kn",
    "pa-IN": "Helsinki-NLP/opus-mt-en-pa",
    # Fallback for unsupported langs — use multilingual model
    "or-IN": "facebook/nllb-200-distilled-600M",
}

# NLLB language codes for the facebook/nllb model
NLLB_LANG_CODES = {
    "hi-IN": "hin_Deva",
    "bn-IN": "ben_Beng",
    "ta-IN": "tam_Taml",
    "te-IN": "tel_Telu",
    "ml-IN": "mal_Mlym",
    "mr-IN": "mar_Deva",
    "gu-IN": "guj_Gujr",
    "kn-IN": "kan_Knda",
    "pa-IN": "pan_Guru",
    "or-IN": "ory_Orya",
}


def _hf_headers():
    return {"Authorization": f"Bearer {HF_API_KEY}"}


def translate_text_hf(text: str, target_language: str) -> str:
    """
    Translate English text to target Indian language using HuggingFace Inference API.
    Uses Helsinki-NLP models (fast, specialized) with NLLB as fallback.
    """
    if not HF_API_KEY:
        raise Exception("HUGGINGFACE_API_KEY not set")

    if not text or not text.strip():
        return text

    model = HF_TRANSLATION_MODELS.get(target_language)

    # Try Helsinki-NLP model first
    if model and "Helsinki" in model:
        try:
            resp = requests.post(
                f"{HF_BASE}/{model}",
                headers=_hf_headers(),
                json={"inputs": text},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0].get("translation_text", text)
            elif resp.status_code == 503:
                # Model loading — wait and retry once
                import time
                time.sleep(8)
                resp = requests.post(
                    f"{HF_BASE}/{model}",
                    headers=_hf_headers(),
                    json={"inputs": text},
                    timeout=30,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and data:
                        return data[0].get("translation_text", text)
            logger.warning(f"Helsinki model {model} returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Helsinki model failed: {e}")

    # Fallback: NLLB-200 multilingual model
    nllb_model = "facebook/nllb-200-distilled-600M"
    tgt_lang = NLLB_LANG_CODES.get(target_language, "hin_Deva")
    try:
        resp = requests.post(
            f"{HF_BASE}/{nllb_model}",
            headers=_hf_headers(),
            json={
                "inputs": text,
                "parameters": {
                    "src_lang": "eng_Latn",
                    "tgt_lang": tgt_lang,
                }
            },
            timeout=40,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                return data[0].get("translation_text", text)
        logger.warning(f"NLLB model returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"NLLB model failed: {e}")

    raise Exception(f"HuggingFace translation failed for {target_language}")


def describe_image_hf(image_bytes: bytes, mime_type: str) -> str:
    """
    Use HuggingFace image-to-text (BLIP) to get a description of an image.
    Used as fallback when Gemini vision quota is exceeded.
    """
    if not HF_API_KEY:
        raise Exception("HUGGINGFACE_API_KEY not set")

    model = "Salesforce/blip-image-captioning-large"
    try:
        resp = requests.post(
            f"{HF_BASE}/{model}",
            headers={**_hf_headers(), "Content-Type": mime_type},
            data=image_bytes,
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                return data[0].get("generated_text", "")
        logger.warning(f"BLIP returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"BLIP image caption failed: {e}")
    return ""


# Tone rewrite prompts for HF fallback
HF_TONE_INSTRUCTIONS = {
    "Email Formal": "You are a world-class formal business email writer. Rewrite the following as ONE complete formal email. Start with 'Subject:'. Use 'Dear Sir/Madam,' greeting. Write a professional body. End with 'Yours sincerely,'. Do NOT use placeholder tokens like [Name] or [Your Name]. Output ONLY the email, nothing else, no explanations.",
    "Email Casual": "You are a master of warm casual business emails. Rewrite the following as ONE complete casual email. Start with 'Subject:'. Use 'Hi there,' greeting. Write a friendly conversational body. End with 'Cheers,'. Do NOT use placeholder tokens like [Name] or [Your Name]. Output ONLY the email, nothing else, no explanations.",
    "Slack": "You are a Slack expert. Rewrite the following as ONE short Slack message (1-3 lines max). Add 1-2 relevant emojis. No greeting, no sign-off. Output ONLY the message, nothing else.",
    "LinkedIn": "You are a top LinkedIn creator. Rewrite the following as ONE viral LinkedIn post with a strong hook, 2-3 short paragraphs, a call-to-action question, and 3-5 hashtags. Output ONLY the post, nothing else.",
    "WhatsApp": "You are a WhatsApp Business expert. Rewrite the following as ONE brief WhatsApp message with a clear call-to-action. Use bullet points (•) for lists. Output ONLY the message, nothing else.",
    "WhatsApp Business": "You are a WhatsApp Business expert. Rewrite the following as ONE brief WhatsApp message with a clear call-to-action. Use bullet points (•) for lists. Output ONLY the message, nothing else.",
}

# Local rule-based tone rewrite — works offline, never fails
def _local_tone_rewrite(text: str, tone: str, user_override: str = None) -> str:
    """Simple rule-based tone rewrite as last resort when all APIs fail."""
    t = text.strip()
    if tone == "Slack":
        return f"👋 {t} 🙏"
    elif tone == "WhatsApp Business":
        return f"Hello! 👋\n\n{t}\n\nPlease let us know if you need any assistance."
    elif tone == "LinkedIn":
        return f"Excited to share this update:\n\n{t}\n\nWhat are your thoughts? Drop a comment below.\n\n#Professional #Update #Growth"
    elif tone == "Email Casual":
        return f"Subject: Quick update\n\nHi there,\n\n{t}\n\nThanks,"
    elif user_override:
        return f"{t}\n\n[Tone: {user_override}]"
    else:  # Email Formal default
        return f"Subject: Important Update\n\nDear Sir/Madam,\n\n{t}\n\nYours sincerely,"


def rewrite_tone_hf(text: str, tone: str, user_override: str = None) -> str:
    """
    Rewrite text in a given tone using HuggingFace.
    Tries Mistral-7B first (best quality), then flan-t5, then local rule-based fallback.
    """
    if not HF_API_KEY:
        logger.warning("No HF API key — using local tone rewrite")
        return _local_tone_rewrite(text, tone, user_override)

    instruction = user_override or HF_TONE_INSTRUCTIONS.get(tone, HF_TONE_INSTRUCTIONS["Email Formal"])
    prompt = f"{instruction}\n\nMessage: {text}\n\nOutput:"

    # Try Mistral-7B-Instruct first — much better at following tone instructions
    mistral_model = "mistralai/Mistral-7B-Instruct-v0.3"
    try:
        resp = requests.post(
            f"{HF_BASE}/{mistral_model}",
            headers=_hf_headers(),
            json={
                "inputs": f"<s>[INST] {instruction}\n\nMessage: {text} [/INST]",
                "parameters": {
                    "max_new_tokens": 400,
                    "temperature": 0.6,
                    "do_sample": True,
                    "return_full_text": False,
                }
            },
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                result = data[0].get("generated_text", "").strip()
                if result and len(result) > 20:
                    logger.info(f"Mistral tone rewrite succeeded for tone={tone}")
                    return result
        elif resp.status_code == 503:
            import time; time.sleep(15)
            resp = requests.post(
                f"{HF_BASE}/{mistral_model}",
                headers=_hf_headers(),
                json={"inputs": f"<s>[INST] {instruction}\n\nMessage: {text} [/INST]",
                      "parameters": {"max_new_tokens": 400, "return_full_text": False}},
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    result = data[0].get("generated_text", "").strip()
                    if result and len(result) > 20:
                        return result
        logger.warning(f"Mistral returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Mistral tone rewrite failed: {e}")

    # Fallback: flan-t5-large with simpler prompt
    flan_model = "google/flan-t5-large"
    simple_prompt = f"{instruction}\n\n{text}"
    try:
        resp = requests.post(
            f"{HF_BASE}/{flan_model}",
            headers=_hf_headers(),
            json={
                "inputs": simple_prompt,
                "parameters": {"max_new_tokens": 300, "do_sample": False},
            },
            timeout=45,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                result = data[0].get("generated_text", "").strip()
                if result and len(result) > 20:
                    logger.info(f"flan-t5 tone rewrite succeeded for tone={tone}")
                    return result
        elif resp.status_code == 503:
            import time; time.sleep(10)
            resp = requests.post(
                f"{HF_BASE}/{flan_model}",
                headers=_hf_headers(),
                json={"inputs": simple_prompt, "parameters": {"max_new_tokens": 300}},
                timeout=45,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    result = data[0].get("generated_text", "").strip()
                    if result and len(result) > 20:
                        return result
        logger.warning(f"flan-t5 returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"flan-t5 tone rewrite failed: {e}")

    # Last resort: local rule-based rewrite — always works
    logger.info(f"Using local rule-based tone rewrite for tone={tone}")
    return _local_tone_rewrite(text, tone, user_override)
