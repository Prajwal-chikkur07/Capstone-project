import os
import re
import json
import logging
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _strip_md_json(raw: str) -> str:
    """Strip markdown code fences from a Gemini JSON response."""
    raw = raw.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return raw.strip()


TONE_SYSTEM_PROMPTS = {
    "Email Formal": """You are an expert business communication writer. Your job is to produce ONE single ready-to-send formal email — nothing else.

CRITICAL: Output EXACTLY ONE version of the email. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to send immediately.

FORMAT (follow exactly):
Subject: [concise subject line]

Dear [Name],

[Body — professional, complete sentences, formal tone]

[Formal closing, e.g. "Yours sincerely," or "Best regards,"]
[Your Name]

RULES:
- One email only. No "Option 1", no "Here are a few versions", no commentary before or after.
- Preserve ALL facts from the original text.
- No markdown formatting like ** or __.
- Output starts with "Subject:" and ends with "[Your Name]".""",

    "Email Casual": """You are a friendly professional writer. Your job is to produce ONE single ready-to-send casual email — nothing else.

CRITICAL: Output EXACTLY ONE version of the email. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to send immediately.

FORMAT (follow exactly):
Subject: [concise subject line]

Hi [Name],

[Body — warm, conversational, contractions are fine]

[Friendly sign-off, e.g. "Cheers," or "Thanks,"]
[Your Name]

RULES:
- One email only. No "Option 1", no "Here are a few versions", no commentary before or after.
- Preserve ALL facts from the original text.
- No markdown formatting like ** or __.
- Output starts with "Subject:" and ends with "[Your Name]".""",

    "Slack": """You are a Slack communication expert. Your job is to produce ONE single ready-to-send Slack message — nothing else.

CRITICAL: Output EXACTLY ONE Slack message. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to send immediately.

FORMAT:
[1-3 short lines or bullet points. Add 1-2 relevant emojis naturally. No salutation, no sign-off.]

RULES:
- One message only. No "Option 1", no commentary before or after.
- Keep it short and scannable.
- Preserve ALL facts from the original text.
- Output is ONLY the message text, nothing else.""",

    "LinkedIn": """You are a LinkedIn content strategist. Your job is to produce ONE single ready-to-post LinkedIn post — nothing else.

CRITICAL: Output EXACTLY ONE LinkedIn post. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to post immediately.

FORMAT:
[Strong opening hook — bold statement or question]

[2-3 short paragraphs, thought-leadership tone, professional yet human]

[Call-to-action, e.g. "What do you think? Drop a comment below."]

#Hashtag1 #Hashtag2 #Hashtag3

RULES:
- One post only. No "Option 1", no commentary before or after.
- Preserve ALL facts from the original text.
- No markdown like ** or __.
- Output is ONLY the post text, nothing else.""",

    "WhatsApp Business": """You are a WhatsApp Business messaging expert. Your job is to produce ONE single ready-to-send WhatsApp message — nothing else.

CRITICAL: Output EXACTLY ONE WhatsApp message. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to send immediately.

FORMAT:
Hello! 👋

[Brief, clear message body. Use bullet points (•) for lists. Simple language, no jargon.]

[Clear next step or question if applicable]

RULES:
- One message only. No "Option 1", no commentary before or after.
- Preserve ALL facts from the original text.
- Output is ONLY the message text, nothing else.""",
}


def _is_quota_error(e) -> bool:
    msg = str(e).lower()
    return "quota" in msg or "429" in msg or "exceeded" in msg or "rate limit" in msg or "resource_exhausted" in msg


def _hf_summarize(text: str) -> str:
    """HuggingFace fallback for summarization using flan-t5."""
    from services.huggingface_client import rewrite_tone_hf
    prompt = f"Summarize this text in 2-3 sentences:\n\n{text}"
    try:
        import requests as req
        resp = req.post(
            "https://api-inference.huggingface.co/models/google/flan-t5-large",
            headers={"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY')}"},
            json={"inputs": prompt, "parameters": {"max_new_tokens": 200}},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                return data[0].get("generated_text", "").strip()
    except Exception as e:
        logger.warning(f"HF summarize fallback failed: {e}")
    return text[:300] + "..."


def summarize_transcript(text: str) -> str:
    """Returns a 2-3 sentence TL;DR summary of the transcript."""
    if not GEMINI_API_KEY:
        return _hf_summarize(text)
    prompt = f"""Summarize this transcript in 2-3 clear sentences. Be concise and capture the key points only.
Output ONLY the summary, no labels, no markdown.

TRANSCRIPT: {text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        return model.generate_content(prompt).text.strip()
    except Exception as e:
        logger.warning(f"Summarize failed: {e}")
        if _is_quota_error(e):
            return _hf_summarize(text)
        return text[:300] + "..."


def generate_meeting_notes(text: str) -> dict:
    """Returns structured meeting notes."""
    empty = {"summary": "", "action_items": [], "decisions": [], "attendees": [], "follow_ups": []}
    if not GEMINI_API_KEY:
        return {**empty, "summary": _hf_summarize(text)}
    prompt = f"""Extract structured meeting notes from this transcript. Respond with ONLY a JSON object (no markdown):
{{
  "summary": "2-3 sentence overview",
  "action_items": ["action 1", "action 2"],
  "decisions": ["decision 1"],
  "attendees": ["name 1"],
  "follow_ups": ["follow-up 1"]
}}

TRANSCRIPT: {text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        raw = _strip_md_json(model.generate_content(prompt).text)
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Meeting notes failed: {e}")
        if _is_quota_error(e):
            return {**empty, "summary": _hf_summarize(text)}
        return {**empty, "summary": text[:200]}


def answer_question(transcript: str, question: str) -> str:
    """Answers a question about the transcript using Gemini."""
    if not GEMINI_API_KEY:
        return "AI Q&A unavailable — API key not configured."
    prompt = f"""You are a helpful assistant. Answer the question based ONLY on the transcript provided.
If the answer is not in the transcript, say "I couldn't find that in the transcript."
Be concise and direct.

TRANSCRIPT:
{transcript}

QUESTION: {question}

ANSWER:"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        return model.generate_content(prompt).text.strip()
    except Exception as e:
        logger.warning(f"Q&A failed: {e}")
        if _is_quota_error(e):
            return "Q&A unavailable — API quota exceeded. Please try again later."
        return "Could not process your question. Please try again."


def analyze_sentiment(text: str) -> dict:
    """Returns sentiment analysis."""
    if not GEMINI_API_KEY:
        return _local_sentiment(text)
    prompt = f"""Analyze the sentiment of this text and respond with ONLY a JSON object (no markdown, no explanation):
{{"sentiment": "positive", "score": 75, "summary": "one short sentence"}}
Use "positive", "neutral", or "negative" for sentiment. Score is 0-100.

TEXT: {text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        raw = _strip_md_json(model.generate_content(prompt).text)
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Sentiment analysis failed: {e}")
        if _is_quota_error(e):
            return _local_sentiment(text)
        return {"sentiment": "neutral", "score": 50, "summary": ""}


def _local_sentiment(text: str) -> dict:
    """Simple keyword-based sentiment fallback when API is unavailable."""
    positive_words = {"good", "great", "excellent", "happy", "love", "wonderful", "amazing", "fantastic", "best", "perfect", "thanks", "thank", "appreciate", "glad", "pleased"}
    negative_words = {"bad", "terrible", "awful", "hate", "worst", "horrible", "poor", "wrong", "fail", "failed", "issue", "problem", "error", "broken", "sorry", "unfortunately"}
    words = set(text.lower().split())
    pos = len(words & positive_words)
    neg = len(words & negative_words)
    if pos > neg:
        return {"sentiment": "positive", "score": min(60 + pos * 5, 90), "summary": "Text appears positive."}
    elif neg > pos:
        return {"sentiment": "negative", "score": max(40 - neg * 5, 10), "summary": "Text appears negative."}
    return {"sentiment": "neutral", "score": 50, "summary": "Text appears neutral."}


def back_translate_check(native_text: str, source_lang: str) -> dict:
    """Translates native text back to English and rates accuracy."""
    if not GEMINI_API_KEY:
        return _hf_back_translate(native_text, source_lang)
    prompt = f"""You are a translation quality checker.
1. Translate this {source_lang} text back to English.
2. Rate how accurately it preserves the original meaning (0-100).
3. Note any meaning drift in one sentence.

Respond ONLY with JSON (no markdown):
{{"back_translation": "english text here", "accuracy_score": 85, "notes": "one sentence"}}

TEXT: {native_text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        raw = _strip_md_json(model.generate_content(prompt).text)
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Back-translate failed: {e}")
        if _is_quota_error(e):
            return _hf_back_translate(native_text, source_lang)
        return {"back_translation": "", "accuracy_score": 0, "notes": ""}


def _hf_back_translate(native_text: str, source_lang: str) -> dict:
    """HuggingFace fallback for back-translation."""
    try:
        from services.huggingface_client import translate_text_hf
        back = translate_text_hf(native_text, "en-IN")
        return {"back_translation": back, "accuracy_score": 70, "notes": "Translated via HuggingFace fallback."}
    except Exception as e:
        logger.warning(f"HF back-translate failed: {e}")
        return {"back_translation": "", "accuracy_score": 0, "notes": "Back-translation unavailable."}


def get_readability_score(text: str) -> dict:
    """Returns Flesch-Kincaid readability metrics."""
    sentences = len(re.findall(r'[.!?]+', text)) or 1
    words_list = text.split()
    words = len(words_list) or 1

    def count_syllables(word):
        word = word.lower().strip(".,!?;:")
        if len(word) <= 3:
            return 1
        count = len(re.findall(r'[aeiou]+', word))
        if word.endswith('e'):
            count -= 1
        return max(1, count)

    syllables = sum(count_syllables(w) for w in words_list)
    score = round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words))
    score = max(0, min(100, score))

    if score >= 90:
        grade, label = "5th grade", "Very Easy"
    elif score >= 80:
        grade, label = "6th grade", "Easy"
    elif score >= 70:
        grade, label = "7th grade", "Fairly Easy"
    elif score >= 60:
        grade, label = "8-9th grade", "Standard"
    elif score >= 50:
        grade, label = "10-12th grade", "Fairly Difficult"
    elif score >= 30:
        grade, label = "College", "Difficult"
    else:
        grade, label = "Professional", "Very Difficult"

    return {"score": score, "grade": grade, "label": label}


def get_tone_confidence(text: str, tone: str) -> dict:
    """Rates how well the rewritten text matches the intended tone."""
    if not GEMINI_API_KEY:
        return {"score": 70, "feedback": "Tone confidence unavailable — API key not configured."}
    prompt = f"""Rate how well this text matches the "{tone}" communication style on a scale of 0-100.
Be strict and precise.

Respond ONLY with JSON (no markdown):
{{"score": 82, "feedback": "one sentence explaining the rating"}}

TEXT: {text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        raw = _strip_md_json(model.generate_content(prompt).text)
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Tone confidence failed: {e}")
        if _is_quota_error(e):
            return {"score": 70, "feedback": "Tone confidence unavailable — API quota exceeded."}
        return {"score": 0, "feedback": ""}


def vision_translate_image(image_bytes: bytes, image_mime: str, target_language: str) -> list:
    """
    Uses Gemini Vision to detect text regions in an image and translate them.
    Returns a list of dicts: { original, translated, x, y, w, h, font_size, bg_color, text_color }
    Coordinates are normalized 0.0-1.0 fractions of image dimensions.
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set")

    LANG_NAMES = {
        'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
        'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
        'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
        'en-IN': 'English',
    }
    lang_name = LANG_NAMES.get(target_language, target_language)

    prompt = f"""You are an expert OCR and translation engine. Analyze this image carefully.

Your task:
1. Read ALL visible text in the image
2. Group related text into logical blocks (e.g. a heading + its paragraph = one block, a label + value = one block)
3. Translate each block to {lang_name}
4. Return bounding box coordinates for each block

IMPORTANT grouping rules:
- Do NOT split a sentence into multiple blocks
- Do NOT create more than 15 blocks total — merge nearby related text
- A "block" should be a complete thought: a heading, a paragraph, a caption, a button label, etc.
- Ignore decorative elements, icons, and UI chrome (browser tabs, scrollbars, window controls)
- Focus on the CONTENT text, not the surrounding application UI

Respond with ONLY a JSON array (no markdown, no explanation):
[
  {{
    "original": "complete original text of this block",
    "translated": "complete translation in {lang_name}",
    "x": 0.1,
    "y": 0.05,
    "w": 0.8,
    "h": 0.08,
    "font_size": 0.04,
    "bg_color": "#ffffff",
    "text_color": "#000000"
  }}
]

Coordinate rules:
- x, y = top-left corner as fraction of image width/height (0.0 to 1.0)
- w, h = width/height as fraction of image dimensions (0.0 to 1.0)
- font_size = approximate text height as fraction of image height
- If text is already in {lang_name}, set translated = original
- Output ONLY the JSON array, nothing else"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        image_part = {"mime_type": image_mime, "data": image_bytes}
        response = model.generate_content([prompt, image_part])
        raw = _strip_md_json(response.text)
        result = json.loads(raw)

        cleaned = []
        for item in result:
            if not isinstance(item, dict):
                continue
            cleaned.append({
                "original":   str(item.get("original", "")),
                "translated": str(item.get("translated", "")),
                "x":          max(0.0, min(1.0, float(item.get("x", 0)))),
                "y":          max(0.0, min(1.0, float(item.get("y", 0)))),
                "w":          max(0.01, min(1.0, float(item.get("w", 0.5)))),
                "h":          max(0.01, min(1.0, float(item.get("h", 0.05)))),
                "font_size":  max(0.01, min(0.2, float(item.get("font_size", 0.03)))),
                "bg_color":   str(item.get("bg_color", "#ffffff")),
                "text_color": str(item.get("text_color", "#000000")),
            })
        return cleaned
    except Exception as e:
        error_str = str(e)
        logger.error(f"Vision translate failed: {e}")

        # Fallback: use HuggingFace BLIP for image description + HF translation
        if "quota" in error_str.lower() or "429" in error_str or "rate" in error_str.lower():
            logger.info("Gemini quota exceeded — trying HuggingFace fallback for vision translate")
            try:
                from services.huggingface_client import describe_image_hf, translate_text_hf
                description = describe_image_hf(image_bytes, image_mime)
                if description:
                    translated = translate_text_hf(description, target_language)
                    return [{
                        "original": description,
                        "translated": translated,
                        "x": 0.1, "y": 0.1, "w": 0.8, "h": 0.1,
                        "font_size": 0.04, "bg_color": "#ffffff", "text_color": "#000000"
                    }]
            except Exception as hf_err:
                logger.error(f"HuggingFace vision fallback failed: {hf_err}")

        raise Exception(f"Vision translation failed: {error_str}")


def suggest_tone(text: str) -> str:
    """Returns the best tone option for the given text."""
    if not GEMINI_API_KEY:
        return _local_suggest_tone(text)
    prompt = f"""Based on this text, which communication tone fits best?
Choose EXACTLY ONE from: Email Formal, Email Casual, Slack, LinkedIn, WhatsApp Business
Respond with ONLY the tone name, nothing else.

TEXT: {text}"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        result = model.generate_content(prompt).text.strip()
        valid = ["Email Formal", "Email Casual", "Slack", "LinkedIn", "WhatsApp Business"]
        return result if result in valid else "Email Formal"
    except Exception as e:
        logger.warning(f"Tone suggestion failed: {e}")
        if _is_quota_error(e):
            return _local_suggest_tone(text)
        return "Email Formal"


def _local_suggest_tone(text: str) -> str:
    """Keyword-based tone suggestion fallback."""
    t = text.lower()
    if any(w in t for w in ["dear", "sincerely", "regards", "formally", "request", "kindly"]):
        return "Email Formal"
    if any(w in t for w in ["hey", "hi", "thanks", "cheers", "catch up", "quick"]):
        return "Email Casual"
    if any(w in t for w in ["slack", "thread", "channel", "dm", "ping", "standup"]):
        return "Slack"
    if any(w in t for w in ["linkedin", "professional", "network", "career", "opportunity", "excited to share"]):
        return "LinkedIn"
    if any(w in t for w in ["whatsapp", "hello", "hi there", "business", "order", "delivery", "customer"]):
        return "WhatsApp Business"
    return "Email Formal"


def rewrite_text_tone(text: str, tone_option: str, user_override: str = None, custom_vocabulary: list = None) -> str:
    """Uses Google Gemini to rewrite the text into the specified tone."""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set")

    if user_override:
        system_prompt = f"""You are an expert communication writer. Your job is to produce ONE single ready-to-send message using this custom tone: "{user_override}".

CRITICAL: Output EXACTLY ONE version. Do NOT give options, alternatives, variations, or explanations.

RULES:
- One message only. No "Option 1", no commentary before or after.
- Fully adopt the requested tone and style.
- Preserve ALL facts from the original text.
- Output is ONLY the rewritten message, nothing else."""
    else:
        system_prompt = TONE_SYSTEM_PROMPTS.get(tone_option, TONE_SYSTEM_PROMPTS["Email Formal"])

    vocab_hint = ""
    if custom_vocabulary:
        pairs = ", ".join([f'"{v["native"]}" -> keep as "{v["english"]}"' for v in custom_vocabulary[:20]])
        vocab_hint = f"\n\nCUSTOM VOCABULARY (preserve these terms exactly): {pairs}"

    prompt = f"""{system_prompt}{vocab_hint}

---
ORIGINAL TEXT:
{text}
---

REWRITTEN OUTPUT:"""

    logger.info(f"Gemini rewrite request: tone='{tone_option}', text='{text[:80]}'")
    model = genai.GenerativeModel('gemini-2.5-flash')

    try:
        response = model.generate_content(prompt)
        logger.info("Gemini rewrite response received.")
        return response.text.strip()
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Gemini API Error: {error_msg}")
        if "quota" in error_msg.lower() or "exceeded" in error_msg.lower() or "429" in error_msg:
            logger.info("Gemini quota exceeded — falling back to HuggingFace for tone rewrite")
            try:
                from services.huggingface_client import rewrite_tone_hf
                return rewrite_tone_hf(text, tone_option, user_override)
            except Exception as hf_err:
                logger.error(f"HuggingFace tone rewrite fallback failed: {hf_err}")
                # Last resort: local rule-based rewrite — never raises
                from services.huggingface_client import _local_tone_rewrite
                return _local_tone_rewrite(text, tone_option, user_override)
        if hasattr(e, 'message'):
            raise Exception(f"Gemini error: {e.message}")
        raise e
