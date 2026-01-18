"""
SQLAlchemy Models for Hypd Games
Migrated from MongoDB to PostgreSQL/Supabase
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, index=True)
    saved_games = Column(JSON, default=list)  # List of game IDs
    high_scores = Column(JSON, default=dict)  # Dict of game_id: score
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    play_sessions = relationship('PlaySession', back_populates='user', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
            "saved_games": self.saved_games or [],
            "high_scores": self.high_scores or {},
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Game(Base):
    __tablename__ = 'games'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    thumbnail_url = Column(Text, nullable=True)  # Base64 or URL
    video_preview_url = Column(Text, nullable=True)
    gif_preview_url = Column(Text, nullable=True)
    preview_type = Column(String(20), default='image')  # 'video', 'gif', 'image'
    game_file_url = Column(Text, nullable=True)  # Supabase Storage URL
    game_file_id = Column(String(255), nullable=True)  # For backward compatibility
    has_game_file = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True, index=True)
    play_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    play_sessions = relationship('PlaySession', back_populates='game', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "thumbnail_url": self.thumbnail_url,
            "video_preview_url": self.video_preview_url,
            "gif_preview_url": self.gif_preview_url,
            "preview_type": self.preview_type,
            "game_file_url": self.game_file_url,
            "game_file_id": self.game_file_id,
            "has_game_file": self.has_game_file,
            "is_visible": self.is_visible,
            "play_count": self.play_count,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class PlaySession(Base):
    __tablename__ = 'play_sessions'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    game_id = Column(String(36), ForeignKey('games.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    duration_seconds = Column(Integer, default=0)
    score = Column(Integer, nullable=True)
    played_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    
    # Relationships
    game = relationship('Game', back_populates='play_sessions')
    user = relationship('User', back_populates='play_sessions')
    
    def to_dict(self):
        return {
            "id": self.id,
            "game_id": self.game_id,
            "user_id": self.user_id,
            "duration_seconds": self.duration_seconds,
            "score": self.score,
            "played_at": self.played_at.isoformat() if self.played_at else None
        }


class AppSettings(Base):
    __tablename__ = 'app_settings'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
