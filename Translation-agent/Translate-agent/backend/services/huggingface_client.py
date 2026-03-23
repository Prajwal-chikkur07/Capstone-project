import os
import requests
import logging
from dotenv import load_dotenv

load_dotenv()
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
    "Email Formal": "Rewrite the following message as a formal professional email. Include a Subject line, formal greeting (Dear [Name],), professional body, and formal sign-off (Yours sincerely, [Your Name]). Output only the email, nothing else.",
    "Email Casual": "Rewrite the following message as a friendly casual email. Include a Subject line, casual greeting (Hi [Name],), conversational body, and friendly sign-off (Cheers, [Your Name]). Output only the email, nothing else.",
    "Slack": "Rewrite the following message as a short Slack message. Keep it brief, add 1-2 relevant emojis, no formal greeting or sign-off. Output only the message.",
    "LinkedIn": "Rewrite the following message as a professional LinkedIn post with a strong opening hook, 2-3 short paragraphs, and 3 relevant hashtags. Output only the post.",
    "WhatsApp Business": "Rewrite the following message as a friendly WhatsApp Business message. Start with Hello, keep it brief and clear, add a call to action. Output only the message.",
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
        return f"Subject: Quick update\n\nHi [Name],\n\n{t}\n\nThanks,\n[Your Name]"
    elif user_override:
        return f"{t}\n\n[Tone: {user_override}]"
    else:  # Email Formal default
        return f"Subject: Important Update\n\nDear [Name],\n\n{t}\n\nYours sincerely,\n[Your Name]"


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
