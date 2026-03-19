import os
import logging
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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
[1–3 short lines or bullet points. Add 1–2 relevant emojis naturally. No salutation, no sign-off.]

RULES:
- One message only. No "Option 1", no commentary before or after.
- Keep it short and scannable.
- Preserve ALL facts from the original text.
- Output is ONLY the message text, nothing else.""",

    "LinkedIn": """You are a LinkedIn content strategist. Your job is to produce ONE single ready-to-post LinkedIn post — nothing else.

CRITICAL: Output EXACTLY ONE LinkedIn post. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to post immediately.

FORMAT:
[Strong opening hook — bold statement or question]

[2–3 short paragraphs, thought-leadership tone, professional yet human]

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

def rewrite_text_tone(text: str, tone_option: str, user_override: str = None) -> str:
    """
    Uses Google Gemini to rewrite the text into the specified tone with structured output.
    """
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set")

    if user_override:
        system_prompt = f"""You are an expert communication writer. Your job is to produce ONE single ready-to-send message using this custom tone: "{user_override}".

CRITICAL: Output EXACTLY ONE version. Do NOT give options, alternatives, variations, or explanations. The output must be copy-pasteable and ready to send immediately.

RULES:
- One message only. No "Option 1", no commentary before or after.
- Fully adopt the requested tone and style.
- Preserve ALL facts from the original text.
- Output is ONLY the rewritten message, nothing else."""
    else:
        system_prompt = TONE_SYSTEM_PROMPTS.get(tone_option, TONE_SYSTEM_PROMPTS["Email Formal"])

    prompt = f"""{system_prompt}

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

        if "quota" in error_msg.lower() or "exceeded" in error_msg.lower():
            logger.warning("Gemini API quota exceeded - returning original text with note")
            return f"{text}\n\n[Note: Tone rewriting unavailable — API quota exceeded. Check billing at https://aistudio.google.com/]"

        if hasattr(e, 'message'):
            raise Exception(f"Gemini error: {e.message}")
        raise e
