"""
models.py — SQLAlchemy ORM models for PostgreSQL.
Synced with Clerk OAuth user data.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Index
from database import Base


class User(Base):
    __tablename__ = "users"

    id           = Column(String(50), primary_key=True)           # Clerk user ID
    email        = Column(String(255), nullable=False, unique=True, index=True)
    first_name   = Column(String(100), nullable=True)
    last_name    = Column(String(100), nullable=True)
    avatar_url   = Column(String, nullable=True)                  # TEXT type in PostgreSQL
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id":         self.id,
            "email":      self.email,
            "first_name": self.first_name,
            "last_name":  self.last_name,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
