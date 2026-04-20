"""
Translation Cache — PostgreSQL + pgvector semantic cache.

Layer 1: Exact match  — sha256(text + lang) lookup → instant, zero cost
Layer 2: Semantic match — Gemini embedding (768d) + pgvector cosine similarity
         Uses: gemini-embedding-001 with output_dimensionality=768

Flow:
  get_cached(text, lang)
    → exact hit  → update hit_count, return immediately
    → semantic hit (sim >= threshold) → update hit_count, return
    → None       → caller hits Sarvam → store_translation(...)
"""

import logging
import os
import re
from threading import Thread
from typing import Optional

import google.generativeai as genai
from sqlalchemy import text as sql_text
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMS = 768

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# ── helpers ──────────────────────────────────────────────────────────────────

def _embed(text: str) -> Optional[list]:
    """Generate a 768-dimensional embedding using Gemini."""
    if not GEMINI_API_KEY:
        return None
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            output_dimensionality=EMBEDDING_DIMS,
        )
        return result["embedding"]
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return None


def _get_engine():
    """Lazy import to avoid circular dependency with database.py."""
    from database import engine
    return engine


def _vec_literal(embedding: list) -> str:
    """Convert a list of floats to pgvector literal string: '[0.1,0.2,...]'"""
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


def _split_sentences(text: str) -> list[str]:
    """
    Split text into sentences. Handles:
    - Period/exclamation/question followed by space + uppercase
    - Comma-separated clauses (common in Indian languages)
    - Newlines
    Returns non-empty stripped sentences.
    """
    # Split on sentence-ending punctuation followed by space, or on newlines
    parts = re.split(r'(?<=[.!?])\s+|\n+', text.strip())
    # Further split long comma-separated clauses (only if > 40 chars)
    result = []
    for part in parts:
        stripped = part.strip()
        if not stripped:
            continue
        if len(stripped) > 40 and ', ' in stripped:
            sub = [s.strip() for s in stripped.split(', ') if s.strip()]
            result.extend(sub)
        else:
            result.append(stripped)
    return result


# ── public API ────────────────────────────────────────────────────────────────

def _get_cached_single(text: str, lang: str, threshold: float, conn) -> Optional[str]:
    """
    Check cache for a single text chunk (no sentence splitting).
    Uses the provided connection — caller manages the transaction.
    Returns cached translation or None.
    """
    # ── Layer 1: exact text match ─────────────────────────────────────
    row = conn.execute(
        sql_text("""
            SELECT id, final_output FROM translation_cache
            WHERE original_text = :text
              AND target_language = :lang
            LIMIT 1
        """),
        {"text": text.strip(), "lang": lang},
    ).fetchone()

    if row:
        conn.execute(
            sql_text("""
                UPDATE translation_cache
                SET hit_count = hit_count + 1,
                    last_accessed_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """),
            {"id": row[0]},
        )
        logger.info(f"Cache HIT (exact) lang={lang} text='{text[:60]}'")
        return row[1]

    # ── Layer 2: semantic similarity via pgvector ─────────────────────
    query_emb = _embed(text)
    if query_emb is None:
        return None

    vec_str = _vec_literal(query_emb)

    result = conn.execute(
        sql_text("""
            SELECT id, final_output,
                   1 - (original_vector <=> cast(:vec AS vector)) AS similarity
            FROM translation_cache
            WHERE target_language = :lang
              AND original_vector IS NOT NULL
            ORDER BY original_vector <=> cast(:vec AS vector)
            LIMIT 1
        """),
        {"vec": vec_str, "lang": lang},
    ).fetchone()

    if result and result[2] >= threshold:
        conn.execute(
            sql_text("""
                UPDATE translation_cache
                SET hit_count = hit_count + 1,
                    last_accessed_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """),
            {"id": result[0]},
        )
        logger.info(f"Cache HIT (semantic {result[2]:.3f}) lang={lang} text='{text[:60]}'")
        return result[1]

    return None


def get_cached(text: str, lang: str, threshold: float = 0.92) -> Optional[str]:
    """
    Returns a cached translation or None.
    1. Try full text (exact + semantic).
    2. If miss, split into sentences and try each individually.
       If ALL sentences hit, join and return the combined result.
       If any sentence misses, return None (caller will translate the full text).
    """
    engine = _get_engine()

    with engine.connect() as conn:
        # ── Try full text first ───────────────────────────────────────────
        full_hit = _get_cached_single(text, lang, threshold, conn)
        if full_hit is not None:
            conn.commit()
            return full_hit

        # ── Sentence-level chunked lookup ─────────────────────────────────
        sentences = _split_sentences(text)
        if len(sentences) <= 1:
            # Single sentence, already tried above
            conn.commit()
            return None

        cached_parts = []
        for sentence in sentences:
            hit = _get_cached_single(sentence, lang, threshold, conn)
            if hit is None:
                # Any miss → full miss, caller will translate everything
                conn.commit()
                logger.info(f"Cache PARTIAL MISS lang={lang} missed='{sentence[:60]}'")
                return None
            cached_parts.append(hit)

        conn.commit()
        combined = " ".join(cached_parts)
        logger.info(f"Cache HIT (chunked, {len(sentences)} sentences) lang={lang} text='{text[:60]}'")
        return combined


def store_translation(
    text: str,
    lang: str,
    translation: str,
    source_language: str = "en-IN",
    tone: str = "standard",
) -> None:
    """Persist a new translation. Embedding is computed in a background thread."""
    engine = _get_engine()

    # Check if exact entry already exists — avoid duplicates
    with engine.connect() as conn:
        existing = conn.execute(
            sql_text("""
                SELECT id FROM translation_cache
                WHERE original_text = :text AND target_language = :lang AND target_tone = :tone
                LIMIT 1
            """),
            {"text": text.strip(), "lang": lang, "tone": tone},
        ).fetchone()

        if existing:
            # Update the output if it changed
            conn.execute(
                sql_text("""
                    UPDATE translation_cache
                    SET final_output = :output, last_accessed_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """),
                {"output": translation, "id": existing[0]},
            )
            conn.commit()
            logger.info(f"Cache UPDATE lang={lang} text='{text[:60]}'")
            return

        # Insert without embedding first (fast)
        conn.execute(
            sql_text("""
                INSERT INTO translation_cache
                    (original_language, target_language, target_tone,
                     original_text, final_output, hit_count)
                VALUES (:src, :tgt, :tone, :text, :output, 1)
            """),
            {
                "src": source_language,
                "tgt": lang,
                "tone": tone,
                "text": text.strip(),
                "output": translation,
            },
        )
        conn.commit()
        logger.info(f"Cache STORE lang={lang} text='{text[:60]}'")

    # Compute and attach embedding in background
    def _attach_embedding():
        emb = _embed(text)
        if emb is None:
            return
        vec_str = _vec_literal(emb)
        try:
            with engine.connect() as c:
                c.execute(
                    sql_text("""
                        UPDATE translation_cache
                        SET original_vector = cast(:vec AS vector)
                        WHERE original_text = :text
                          AND target_language = :lang
                          AND target_tone = :tone
                          AND original_vector IS NULL
                    """),
                    {"vec": vec_str, "text": text.strip(), "lang": lang, "tone": tone},
                )
                c.commit()
        except Exception as e:
            logger.warning(f"Failed to attach embedding: {e}")

    Thread(target=_attach_embedding, daemon=True).start()


def get_stats() -> dict:
    """Return cache statistics."""
    engine = _get_engine()
    with engine.connect() as conn:
        total = conn.execute(
            sql_text("SELECT COUNT(*) FROM translation_cache")
        ).fetchone()[0]
        hits = conn.execute(
            sql_text("SELECT COALESCE(SUM(hit_count), 0) FROM translation_cache")
        ).fetchone()[0]
        langs = conn.execute(
            sql_text("""
                SELECT target_language, COUNT(*), COALESCE(SUM(hit_count), 0)
                FROM translation_cache
                GROUP BY target_language
            """)
        ).fetchall()
        return {
            "total_entries": total,
            "total_hits": hits,
            "by_language": {r[0]: {"entries": r[1], "hits": r[2]} for r in langs},
        }


def clear_cache(lang: Optional[str] = None) -> int:
    """Delete cache entries. Returns number of rows deleted."""
    engine = _get_engine()
    with engine.connect() as conn:
        if lang:
            result = conn.execute(
                sql_text("DELETE FROM translation_cache WHERE target_language = :lang"),
                {"lang": lang},
            )
        else:
            result = conn.execute(sql_text("DELETE FROM translation_cache"))
        conn.commit()
        return result.rowcount


# ══════════════════════════════════════════════════════════════════════════════
# RETONING CACHE — uses public.retoning_cache table with pgvector
# ══════════════════════════════════════════════════════════════════════════════

def _get_cached_retone_single(text: str, tone: str, language: str, threshold: float, conn) -> Optional[str]:
    """Check retoning cache for a single text chunk. Caller manages transaction."""
    # ── Layer 1: exact match ──────────────────────────────────────────
    row = conn.execute(
        sql_text("""
            SELECT id, rewritten_text FROM retoning_cache
            WHERE original_text = :text
              AND target_tone = :tone
              AND language = :lang
            LIMIT 1
        """),
        {"text": text.strip(), "tone": tone, "lang": language},
    ).fetchone()

    if row:
        conn.execute(
            sql_text("""
                UPDATE retoning_cache
                SET hit_count = hit_count + 1,
                    last_accessed_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """),
            {"id": row[0]},
        )
        logger.info(f"Retone cache HIT (exact) tone={tone} text='{text[:60]}'")
        return row[1]

    # ── Layer 2: semantic similarity ──────────────────────────────────
    query_emb = _embed(text)
    if query_emb is None:
        return None

    vec_str = _vec_literal(query_emb)

    result = conn.execute(
        sql_text("""
            SELECT id, rewritten_text,
                   1 - (original_vector <=> cast(:vec AS vector)) AS similarity
            FROM retoning_cache
            WHERE target_tone = :tone
              AND language = :lang
              AND original_vector IS NOT NULL
            ORDER BY original_vector <=> cast(:vec AS vector)
            LIMIT 1
        """),
        {"vec": vec_str, "tone": tone, "lang": language},
    ).fetchone()

    if result and result[2] >= threshold:
        conn.execute(
            sql_text("""
                UPDATE retoning_cache
                SET hit_count = hit_count + 1,
                    last_accessed_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """),
            {"id": result[0]},
        )
        logger.info(f"Retone cache HIT (semantic {result[2]:.3f}) tone={tone} text='{text[:60]}'")
        return result[1]

    return None


def get_cached_retone(text: str, tone: str, language: str = "en-IN", threshold: float = 0.92) -> Optional[str]:
    """
    Returns a cached rewritten text or None.
    1. Try full text (exact + semantic).
    2. If miss, split into sentences and try each individually.
       If ALL sentences hit, join and return. Any miss → return None.
    """
    engine = _get_engine()

    with engine.connect() as conn:
        # ── Try full text first ───────────────────────────────────────────
        full_hit = _get_cached_retone_single(text, tone, language, threshold, conn)
        if full_hit is not None:
            conn.commit()
            return full_hit

        # ── Sentence-level chunked lookup ─────────────────────────────────
        sentences = _split_sentences(text)
        if len(sentences) <= 1:
            conn.commit()
            return None

        cached_parts = []
        for sentence in sentences:
            hit = _get_cached_retone_single(sentence, tone, language, threshold, conn)
            if hit is None:
                conn.commit()
                logger.info(f"Retone cache PARTIAL MISS tone={tone} missed='{sentence[:60]}'")
                return None
            cached_parts.append(hit)

        conn.commit()
        combined = "\n\n".join(cached_parts)
        logger.info(f"Retone cache HIT (chunked, {len(sentences)} sentences) tone={tone} text='{text[:60]}'")
        return combined


def store_retone(text: str, tone: str, rewritten: str, language: str = "en-IN") -> None:
    """Persist a retoned result. Embedding is computed in a background thread."""
    engine = _get_engine()

    with engine.connect() as conn:
        # Check for duplicate
        existing = conn.execute(
            sql_text("""
                SELECT id FROM retoning_cache
                WHERE original_text = :text AND target_tone = :tone AND language = :lang
                LIMIT 1
            """),
            {"text": text.strip(), "tone": tone, "lang": language},
        ).fetchone()

        if existing:
            conn.execute(
                sql_text("""
                    UPDATE retoning_cache
                    SET rewritten_text = :rewritten, last_accessed_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """),
                {"rewritten": rewritten, "id": existing[0]},
            )
            conn.commit()
            logger.info(f"Retone cache UPDATE tone={tone} text='{text[:60]}'")
            return

        # Insert with embedding computed inline (vector is NOT NULL in schema)
        emb = _embed(text)
        if emb is None:
            # Can't insert without vector (NOT NULL constraint), log and skip
            logger.warning(f"Retone cache SKIP (no embedding) tone={tone} text='{text[:60]}'")
            return

        vec_str = _vec_literal(emb)
        conn.execute(
            sql_text("""
                INSERT INTO retoning_cache
                    (language, target_tone, original_text, original_vector, rewritten_text, hit_count)
                VALUES (:lang, :tone, :text, cast(:vec AS vector), :rewritten, 1)
            """),
            {
                "lang": language,
                "tone": tone,
                "text": text.strip(),
                "vec": vec_str,
                "rewritten": rewritten,
            },
        )
        conn.commit()
        logger.info(f"Retone cache STORE tone={tone} text='{text[:60]}'")
