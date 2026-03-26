"""
Auth router — /api/auth/signup, /api/auth/login, /api/auth/me
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, field_validator
from services.auth import create_user, authenticate_user, get_user_by_id, create_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer()

# ── Request / Response models ─────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

# ── Dependency: extract + verify JWT ─────────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        payload = decode_token(credentials.credentials)
        user = get_user_by_id(int(payload["sub"]))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest):
    try:
        user  = create_user(req.name, req.email, req.password)
        token = create_token(user["id"], user["email"])
        return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    try:
        user  = authenticate_user(req.email, req.password)
        token = create_token(user["id"], user["email"])
        return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
