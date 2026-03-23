"""
JWT Authentication service — signup, login, token verification.
Uses SQLite (via aiosqlite) so no external DB is needed on Render free tier.
"""
import os
import sqlite3
import hashlib
import hmac
import time
import json
import base64
from datetime import datetime, timedelta, timezone

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production-use-a-long-random-string")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 72
DB_PATH = os.getenv("AUTH_DB_PATH", "auth.db")

# ── Database setup ────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT    NOT NULL,
                email     TEXT    NOT NULL UNIQUE,
                password  TEXT    NOT NULL,
                created_at TEXT   NOT NULL
            )
        """)
        conn.commit()

# Run on import
init_db()

# ── Password hashing (bcrypt-style using hashlib + salt) ─────────────────────
def hash_password(password: str) -> str:
    """SHA-256 + random salt, stored as salt$hash."""
    salt = base64.b64encode(os.urandom(16)).decode()
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
        return hmac.compare_digest(hashlib.sha256((salt + password).encode()).hexdigest(), h)
    except Exception:
        return False

# ── JWT (pure stdlib — no python-jose dependency) ────────────────────────────
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))

def create_token(user_id: int, email: str) -> str:
    header  = _b64url_encode(json.dumps({"alg": ALGORITHM, "typ": "JWT"}).encode())
    exp     = int(time.time()) + TOKEN_EXPIRE_HOURS * 3600
    payload = _b64url_encode(json.dumps({"sub": str(user_id), "email": email, "exp": exp}).encode())
    sig_input = f"{header}.{payload}".encode()
    sig = _b64url_encode(hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"

def decode_token(token: str) -> dict:
    """Returns payload dict or raises ValueError."""
    try:
        header, payload, sig = token.split(".")
    except ValueError:
        raise ValueError("Malformed token")
    sig_input = f"{header}.{payload}".encode()
    expected  = _b64url_encode(hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid signature")
    data = json.loads(_b64url_decode(payload))
    if data.get("exp", 0) < time.time():
        raise ValueError("Token expired")
    return data

# ── User CRUD ─────────────────────────────────────────────────────────────────
def create_user(name: str, email: str, password: str) -> dict:
    hashed = hash_password(password)
    now    = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, password, created_at) VALUES (?,?,?,?)",
                (name.strip(), email.lower().strip(), hashed, now)
            )
            conn.commit()
            return {"id": cur.lastrowid, "name": name.strip(), "email": email.lower().strip()}
        except sqlite3.IntegrityError:
            raise ValueError("Email already registered")

def authenticate_user(email: str, password: str) -> dict:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    if not row or not verify_password(password, row["password"]):
        raise ValueError("Invalid email or password")
    return {"id": row["id"], "name": row["name"], "email": row["email"]}

def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    return dict(row)
