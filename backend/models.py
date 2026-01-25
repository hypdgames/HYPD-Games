"""
SQLAlchemy Models for Hypd Games
Migrated from MongoDB to PostgreSQL/Supabase
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database import Base
import enum


def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class FriendshipStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class ChallengeStatus(enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"


class ChallengeType(enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    FRIEND = "friend"


class User(Base):
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, index=True)
    is_banned = Column(Boolean, default=False, index=True)
    ban_reason = Column(String(500), nullable=True)
    saved_games = Column(JSON, default=list)  # List of game IDs
    high_scores = Column(JSON, default=dict)  # Dict of game_id: score
    total_play_time = Column(Integer, default=0)  # Total seconds played
    total_games_played = Column(Integer, default=0)
    avatar_url = Column(Text, nullable=True)
    bio = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    last_active_at = Column(DateTime(timezone=True), default=utc_now)
    
    # Login streak tracking
    login_streak = Column(Integer, default=0)  # Current consecutive days
    best_login_streak = Column(Integer, default=0)  # Highest streak achieved
    last_login_date = Column(Date, nullable=True)  # Last date user logged in (date only, not time)
    total_login_days = Column(Integer, default=0)  # Total unique days logged in
    streak_points = Column(Integer, default=0)  # Points earned from streaks
    
    # Relationships
    play_sessions = relationship('PlaySession', back_populates='user', cascade='all, delete-orphan')
    sent_friend_requests = relationship('Friendship', foreign_keys='Friendship.requester_id', back_populates='requester', cascade='all, delete-orphan')
    received_friend_requests = relationship('Friendship', foreign_keys='Friendship.addressee_id', back_populates='addressee', cascade='all, delete-orphan')
    challenge_participations = relationship('ChallengeParticipant', back_populates='user', cascade='all, delete-orphan')
    
    def to_dict(self, include_private=False):
        data = {
            "id": self.id,
            "username": self.username,
            "is_admin": self.is_admin,
            "is_banned": self.is_banned or False,
            "ban_reason": self.ban_reason,
            "total_play_time": self.total_play_time or 0,
            "total_games_played": self.total_games_played or 0,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_active_at": self.last_active_at.isoformat() if self.last_active_at else None
        }
        if include_private:
            data["email"] = self.email
            data["saved_games"] = self.saved_games or []
            data["high_scores"] = self.high_scores or {}
        return data


class Friendship(Base):
    __tablename__ = 'friendships'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    requester_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    addressee_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    status = Column(SQLEnum(FriendshipStatus), default=FriendshipStatus.PENDING)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    # Relationships
    requester = relationship('User', foreign_keys=[requester_id], back_populates='sent_friend_requests')
    addressee = relationship('User', foreign_keys=[addressee_id], back_populates='received_friend_requests')
    
    def to_dict(self):
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "addressee_id": self.addressee_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Challenge(Base):
    __tablename__ = 'challenges'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    challenge_type = Column(SQLEnum(ChallengeType), default=ChallengeType.DAILY)
    status = Column(SQLEnum(ChallengeStatus), default=ChallengeStatus.ACTIVE)
    
    # Challenge criteria
    target_type = Column(String(50), nullable=False)  # 'plays', 'score', 'time', 'games_played'
    target_value = Column(Integer, nullable=False)
    game_id = Column(String(36), ForeignKey('games.id', ondelete='SET NULL'), nullable=True)  # If specific game
    
    # For friend challenges
    creator_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Rewards
    reward_points = Column(Integer, default=0)
    reward_badge = Column(String(100), nullable=True)
    
    # Timing
    starts_at = Column(DateTime(timezone=True), default=utc_now)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    participants = relationship('ChallengeParticipant', back_populates='challenge', cascade='all, delete-orphan')
    game = relationship('Game')
    creator = relationship('User')
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "challenge_type": self.challenge_type.value,
            "status": self.status.value,
            "target_type": self.target_type,
            "target_value": self.target_value,
            "game_id": self.game_id,
            "creator_id": self.creator_id,
            "reward_points": self.reward_points,
            "reward_badge": self.reward_badge,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ChallengeParticipant(Base):
    __tablename__ = 'challenge_participants'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    challenge_id = Column(String(36), ForeignKey('challenges.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    joined_at = Column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    challenge = relationship('Challenge', back_populates='participants')
    user = relationship('User', back_populates='challenge_participations')
    
    def to_dict(self):
        return {
            "id": self.id,
            "challenge_id": self.challenge_id,
            "user_id": self.user_id,
            "progress": self.progress,
            "completed": self.completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None
        }


class LeaderboardEntry(Base):
    __tablename__ = 'leaderboard_entries'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    game_id = Column(String(36), ForeignKey('games.id', ondelete='CASCADE'), nullable=True, index=True)  # Null for global
    leaderboard_type = Column(String(50), nullable=False, index=True)  # 'global', 'game', 'weekly', 'daily'
    score = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)
    period_start = Column(DateTime(timezone=True), nullable=True)  # For weekly/daily boards
    period_end = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    # Relationships
    user = relationship('User')
    game = relationship('Game')
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "game_id": self.game_id,
            "leaderboard_type": self.leaderboard_type,
            "score": self.score,
            "rank": self.rank,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class AnalyticsEvent(Base):
    """Track detailed analytics events for reporting"""
    __tablename__ = 'analytics_events'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(String(50), nullable=False, index=True)  # 'page_view', 'game_start', 'game_end', 'ad_impression', etc.
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    game_id = Column(String(36), ForeignKey('games.id', ondelete='SET NULL'), nullable=True, index=True)
    session_id = Column(String(36), nullable=True, index=True)
    event_data = Column(JSON, default=dict)  # Additional event data
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "user_id": self.user_id,
            "game_id": self.game_id,
            "session_id": self.session_id,
            "event_data": self.event_data,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }


class DailyStats(Base):
    """Aggregated daily statistics for faster queries"""
    __tablename__ = 'daily_stats'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_plays = Column(Integer, default=0)
    unique_players = Column(Integer, default=0)
    new_users = Column(Integer, default=0)
    total_play_time = Column(Integer, default=0)  # In seconds
    ad_impressions = Column(Integer, default=0)
    ad_clicks = Column(Integer, default=0)
    estimated_revenue = Column(Float, default=0.0)
    top_games = Column(JSON, default=list)  # [{game_id, plays}]
    
    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "total_plays": self.total_plays,
            "unique_players": self.unique_players,
            "new_users": self.new_users,
            "total_play_time": self.total_play_time,
            "ad_impressions": self.ad_impressions,
            "ad_clicks": self.ad_clicks,
            "estimated_revenue": self.estimated_revenue,
            "top_games": self.top_games
        }


class Game(Base):
    __tablename__ = 'games'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    thumbnail_url = Column(Text, nullable=True)  # Banner/cover image (landscape)
    icon_url = Column(Text, nullable=True)  # Square icon image (for grids)
    video_preview_url = Column(Text, nullable=True)
    gif_preview_url = Column(Text, nullable=True)
    preview_type = Column(String(20), default='image')  # 'video', 'gif', 'image'
    game_file_url = Column(Text, nullable=True)  # Supabase Storage URL or GameDistribution embed URL
    game_file_id = Column(String(255), nullable=True)  # For backward compatibility
    has_game_file = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True, index=True)
    play_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    # GameDistribution specific fields
    gd_game_id = Column(String(255), nullable=True, unique=True, index=True)  # GameDistribution game ID
    source = Column(String(50), default='custom')  # 'custom', 'gamedistribution'
    embed_url = Column(Text, nullable=True)  # GameDistribution embed URL
    instructions = Column(Text, nullable=True)  # How to play instructions
    
    # Relationships
    play_sessions = relationship('PlaySession', back_populates='game', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "thumbnail_url": self.thumbnail_url,
            "icon_url": self.icon_url,
            "video_preview_url": self.video_preview_url,
            "gif_preview_url": self.gif_preview_url,
            "preview_type": self.preview_type,
            "game_file_url": self.game_file_url,
            "game_file_id": self.game_file_id,
            "has_game_file": self.has_game_file,
            "is_visible": self.is_visible,
            "play_count": self.play_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "gd_game_id": self.gd_game_id,
            "source": self.source or "custom",
            "embed_url": self.embed_url,
            "instructions": self.instructions
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
