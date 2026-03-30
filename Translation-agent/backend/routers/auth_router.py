"""
Auth router — Clerk OAuth integration with /api/auth/sync-user endpoint
User data is synced to Neon PostgreSQL on Clerk signup completion.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator, field_serializer
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer()

# ── Request / Response models ─────────────────────────────────────────────────
class SyncUserRequest(BaseModel):
    """Request body when frontend syncs Clerk user to database after signup"""
    id: str                          # Clerk user ID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v.lower().strip()

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    avatar_url: Optional[str]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @field_serializer('created_at')
    def serialize_created_at(self, value, _info):
        return value.isoformat() if value else None

# ── Database helpers ──────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/sync-user", response_model=UserResponse)
def sync_user(req: SyncUserRequest, db: Session = Depends(get_db)):
    """
    Sync Clerk user data to Neon database.
    Called from frontend after Clerk signup completes.
    Creates user if doesn't exist; updates if already exists.
    """
    try:
        print(f"[SYNC-USER] Syncing user: {req.id} ({req.email})")
        
        # Check if user exists
        existing_user = db.query(User).filter(User.id == req.id).first()
        
        if existing_user:
            # Update existing user
            print(f"[SYNC-USER] User {req.id} exists, updating...")
            existing_user.email = req.email
            existing_user.first_name = req.first_name
            existing_user.last_name = req.last_name
            existing_user.avatar_url = req.avatar_url
            db.commit()
            db.refresh(existing_user)
            print(f"[SYNC-USER] Updated user {req.id}")
            return existing_user
        else:
            # Create new user
            print(f"[SYNC-USER] Creating new user {req.id}")
            new_user = User(
                id=req.id,
                email=req.email,
                first_name=req.first_name,
                last_name=req.last_name,
                avatar_url=req.avatar_url,
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"[SYNC-USER] Created user {req.id}")
            return new_user
    except Exception as e:
        db.rollback()
        print(f"[SYNC-USER] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync user: {str(e)}")

@router.get("/me", response_model=UserResponse)
def get_me(db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    """
    Get current authenticated user from Clerk token.
    Clerk token (JWT) contains the user ID in the 'sub' claim.
    """
    try:
        from jwt import decode
        import os
        
        token = credentials.credentials
        # Decode Clerk token without verification (Clerk validates on their side)
        # In production, verify against Clerk's JWKS
        payload = decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database")
        
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@router.get("/debug/users")
def debug_list_all_users(db: Session = Depends(get_db)):
    """DEBUG ENDPOINT: List all users in database (remove in production)"""
    try:
        users = db.query(User).all()
        print(f"[DEBUG] Total users in database: {len(users)}")
        return {
            "total_users": len(users),
            "users": [user.to_dict() for user in users]
        }
    except Exception as e:
        return {"error": str(e), "total_users": 0, "users": []}

@router.get("/debug/user/{user_id}")
def debug_get_user(user_id: str, db: Session = Depends(get_db)):
    """DEBUG ENDPOINT: Check if a specific user exists in database (remove in production)"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            print(f"[DEBUG] Found user {user_id}")
            return {"exists": True, "user": user.to_dict()}
        else:
            print(f"[DEBUG] User {user_id} not found")
            return {"exists": False, "user": None}
    except Exception as e:
        return {"exists": False, "error": str(e)}


