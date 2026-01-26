"""
Hypd Games API Server
Backend powered by FastAPI + Supabase PostgreSQL + Supabase Storage
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import select, update, delete, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client, Client
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import io
import base64
import zipfile
from PIL import Image
import httpx
from collections import defaultdict
import time

# Local imports
from database import get_db, engine, Base
from models import (
    User, Game, PlaySession, AppSettings,
    Friendship, FriendshipStatus, Challenge, ChallengeParticipant,
    ChallengeType, ChallengeStatus, LeaderboardEntry, AnalyticsEvent, DailyStats,
    WalletTransaction, TransactionType, TransactionStatus, CoinPackage, PremiumGame, UserUnlockedGame
)
from cache import (
    get_games_feed, set_games_feed, invalidate_games_cache,
    get_leaderboard, set_leaderboard, invalidate_leaderboard,
    is_redis_available, get_cache, set_cache, delete_cache
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging (must be early for other initializations)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Security logging for auth events
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'hypd-games-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    logger.info("Stripe API key configured")

# Supabase Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

# Initialize Supabase client for Storage
supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Supabase Storage client initialized")

# Security
security = HTTPBearer()

# In-memory game file storage (fallback if Supabase Storage not available)
game_files_cache: dict = {}

# Supabase Storage bucket names
GAMES_BUCKET = "games"
THUMBNAILS_BUCKET = "game-thumbnails"
PREVIEWS_BUCKET = "game-previews"

# Initialize storage buckets
async def initialize_storage_buckets():
    """Create storage buckets if they don't exist"""
    if not supabase_client:
        logger.warning("Supabase client not initialized, skipping bucket creation")
        return
    
    try:
        # List existing buckets
        existing_buckets = supabase_client.storage.list_buckets()
        existing_names = [b.name for b in existing_buckets]
        
        buckets_to_create = [
            (GAMES_BUCKET, {"public": True}),
            (THUMBNAILS_BUCKET, {"public": True}),
            (PREVIEWS_BUCKET, {"public": True}),
        ]
        
        for bucket_name, options in buckets_to_create:
            if bucket_name not in existing_names:
                try:
                    supabase_client.storage.create_bucket(bucket_name, options)
                    logger.info(f"Created storage bucket: {bucket_name}")
                except Exception as e:
                    logger.warning(f"Bucket {bucket_name} may already exist: {e}")
    except Exception as e:
        logger.error(f"Error initializing storage buckets: {e}")

# Upload file to Supabase Storage
def upload_to_storage(bucket: str, file_path: str, content: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
    """Upload file to Supabase Storage and return public URL"""
    if not supabase_client:
        return None
    
    try:
        supabase_client.storage.from_(bucket).upload(
            path=file_path,
            file=content,
            file_options={
                "content-type": content_type,
                "cache-control": "3600"
            }
        )
        
        # Get public URL
        public_url = supabase_client.storage.from_(bucket).get_public_url(file_path)
        return public_url
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        return None

# Delete file from Supabase Storage
def delete_from_storage(bucket: str, file_path: str) -> bool:
    """Delete file from Supabase Storage"""
    if not supabase_client:
        return False
    
    try:
        supabase_client.storage.from_(bucket).remove([file_path])
        return True
    except Exception as e:
        logger.error(f"Storage delete error: {e}")
        return False

# Download file from Supabase Storage
def download_from_storage(bucket: str, file_path: str) -> Optional[bytes]:
    """Download file from Supabase Storage"""
    if not supabase_client:
        return None
    
    try:
        response = supabase_client.storage.from_(bucket).download(file_path)
        return response
    except Exception as e:
        logger.error(f"Storage download error: {e}")
        return None

# Image compression helper
def compress_image(image_data: bytes, max_size: int = 800, quality: int = 75) -> str:
    """Compress and resize image, return as base64 data URL"""
    try:
        img = Image.open(io.BytesIO(image_data))
        
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        compressed_data = buffer.getvalue()
        
        return f"data:image/jpeg;base64,{base64.b64encode(compressed_data).decode()}"
    except Exception as e:
        logger.error(f"Image compression error: {e}")
        return f"data:image/jpeg;base64,{base64.b64encode(image_data).decode()}"

# Image compression helper that returns bytes (for Supabase Storage upload)
def compress_image_bytes(image_data: bytes, max_size: int = 800, quality: int = 75) -> bytes:
    """Compress and resize image, return as bytes"""
    try:
        img = Image.open(io.BytesIO(image_data))
        
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        return buffer.getvalue()
    except Exception as e:
        logger.error(f"Image compression error: {e}")
        return image_data

# Create the main app
app = FastAPI(title="Hypd Games API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== RATE LIMITING ====================

# Simple in-memory rate limiter (for production, use Redis)
rate_limit_store: dict = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 10  # max requests per window for auth endpoints

def check_rate_limit(identifier: str, max_requests: int = RATE_LIMIT_MAX_REQUESTS) -> bool:
    """Check if request should be rate limited. Returns True if allowed."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    
    # Clean old entries
    rate_limit_store[identifier] = [t for t in rate_limit_store[identifier] if t > window_start]
    
    if len(rate_limit_store[identifier]) >= max_requests:
        return False
    
    rate_limit_store[identifier].append(now)
    return True

def get_client_ip(request: Request) -> str:
    """Get client IP from request, handling proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

# ==================== PYDANTIC MODELS ====================

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v):
        """Enforce password strength requirements"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """Validate username format"""
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_admin: bool
    saved_games: List[str] = []
    high_scores: dict = {}
    created_at: Optional[str] = None
    # Login streak fields
    login_streak: int = 0
    best_login_streak: int = 0
    total_login_days: int = 0
    streak_points: int = 0
    last_login_date: Optional[str] = None

class GameCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "Action"
    thumbnail_url: Optional[str] = None
    icon_url: Optional[str] = None
    preview_type: str = "image"

class GameResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    thumbnail_url: Optional[str] = None
    icon_url: Optional[str] = None
    video_preview_url: Optional[str] = None
    gif_preview_url: Optional[str] = None
    preview_type: str = "image"
    game_file_url: Optional[str] = None  # Supabase Storage URL or GD embed URL
    has_game_file: bool = False
    is_visible: bool = True
    play_count: int = 0
    created_at: Optional[str] = None
    # GameDistribution fields
    gd_game_id: Optional[str] = None
    source: str = "custom"
    embed_url: Optional[str] = None
    instructions: Optional[str] = None

class PlaySessionCreate(BaseModel):
    game_id: str
    duration_seconds: int
    score: Optional[int] = None

# GameDistribution API Configuration
GD_API_BASE = "https://catalog.api.gamedistribution.com/api/v3.0"

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        pass
    return None

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint"""
    try:
        await db.execute(select(1))
        return {"status": "healthy", "database": "connected", "type": "postgresql"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected"}

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = get_client_ip(request)
    
    # Rate limiting
    if not check_rate_limit(f"register:{client_ip}", max_requests=5):
        security_logger.warning(f"Rate limit exceeded for registration from IP: {client_ip}")
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
    
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        security_logger.info(f"Registration attempt with existing email from IP: {client_ip}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    new_user = User(
        id=str(uuid.uuid4()),
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        is_admin=False,
        saved_games=[],
        high_scores={}
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    security_logger.info(f"New user registered: {new_user.id} ({new_user.username}) from IP: {client_ip}")
    
    token = create_token(new_user.id)
    return {"access_token": token, "user": UserResponse(**new_user.to_dict(include_private=True))}

@api_router.post("/auth/login")
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = get_client_ip(request)
    
    # Rate limiting
    if not check_rate_limit(f"login:{client_ip}", max_requests=10):
        security_logger.warning(f"Rate limit exceeded for login from IP: {client_ip}")
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
    
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        security_logger.warning(f"Failed login attempt for email: {credentials.email} from IP: {client_ip}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is banned
    if user.is_banned:
        security_logger.warning(f"Banned user login attempt: {user.id} from IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Account is banned")
    
    # ==================== LOGIN STREAK LOGIC ====================
    today = datetime.now(timezone.utc).date()
    last_login = user.last_login_date
    
    streak_updated = False
    points_earned = 0
    
    if last_login is None:
        # First login ever - start streak at 1
        user.login_streak = 1
        user.best_login_streak = 1
        user.total_login_days = 1
        user.streak_points = 10  # Base points for first login
        points_earned = 10
        streak_updated = True
    elif last_login == today:
        # Already logged in today - don't update streak
        pass
    elif last_login == today - timedelta(days=1):
        # Consecutive day - increment streak
        user.login_streak = (user.login_streak or 0) + 1
        user.total_login_days = (user.total_login_days or 0) + 1
        
        # Bonus points based on streak length
        if user.login_streak <= 7:
            points_earned = 10 * user.login_streak  # Day 1: 10, Day 7: 70
        elif user.login_streak <= 30:
            points_earned = 100 + (user.login_streak - 7) * 15  # Up to 445 at day 30
        else:
            points_earned = 500 + (user.login_streak - 30) * 20  # 500+ after day 30
        
        user.streak_points = (user.streak_points or 0) + points_earned
        
        # Update best streak if current is higher
        if user.login_streak > (user.best_login_streak or 0):
            user.best_login_streak = user.login_streak
        
        streak_updated = True
    else:
        # Streak broken (more than 1 day gap) - reset to 1
        user.login_streak = 1
        user.total_login_days = (user.total_login_days or 0) + 1
        points_earned = 10  # Base points for new streak
        user.streak_points = (user.streak_points or 0) + points_earned
        streak_updated = True
    
    # Update last login date
    if last_login != today:
        user.last_login_date = today
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                login_streak=user.login_streak,
                best_login_streak=user.best_login_streak,
                last_login_date=user.last_login_date,
                total_login_days=user.total_login_days,
                streak_points=user.streak_points,
                last_active_at=datetime.now(timezone.utc)
            )
        )
        await db.commit()
        await db.refresh(user)
        
        if streak_updated:
            logger.info(f"Login streak updated for user {user.id}: streak={user.login_streak}, points_earned={points_earned}")
    
    security_logger.info(f"Successful login for user: {user.id} from IP: {client_ip}")
    
    token = create_token(user.id)
    return {"access_token": token, "user": UserResponse(**user.to_dict(include_private=True))}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(**user.to_dict(include_private=True))

# ==================== USER STREAK ENDPOINTS ====================

@api_router.get("/user/streak")
async def get_user_streak(user: User = Depends(get_current_user)):
    """Get current user's login streak information"""
    today = datetime.now(timezone.utc).date()
    last_login = user.last_login_date
    
    # Calculate if streak is still active (hasn't been broken)
    streak_active = False
    if last_login:
        days_since_login = (today - last_login).days
        streak_active = days_since_login <= 1  # Active if logged in today or yesterday
    
    # Calculate days until next milestone
    current_streak = user.login_streak or 0
    milestones = [7, 14, 30, 60, 90, 180, 365]
    next_milestone = None
    days_to_milestone = None
    
    for m in milestones:
        if current_streak < m:
            next_milestone = m
            days_to_milestone = m - current_streak
            break
    
    # Calculate bonus multiplier
    if current_streak <= 7:
        multiplier = current_streak
    elif current_streak <= 30:
        multiplier = 7 + ((current_streak - 7) * 1.5)
    else:
        multiplier = 7 + 34.5 + ((current_streak - 30) * 2)
    
    return {
        "current_streak": current_streak,
        "best_streak": user.best_login_streak or 0,
        "total_login_days": user.total_login_days or 0,
        "streak_points": user.streak_points or 0,
        "last_login_date": user.last_login_date.isoformat() if user.last_login_date else None,
        "streak_active": streak_active,
        "next_milestone": next_milestone,
        "days_to_milestone": days_to_milestone,
        "current_multiplier": round(multiplier, 1)
    }

@api_router.get("/user/streak/leaderboard")
async def get_streak_leaderboard(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Get top users by login streak"""
    result = await db.execute(
        select(User)
        .where(User.is_banned == False)
        .order_by(desc(User.login_streak))
        .limit(limit)
    )
    users = result.scalars().all()
    
    leaderboard = []
    for i, u in enumerate(users, 1):
        leaderboard.append({
            "rank": i,
            "username": u.username,
            "login_streak": u.login_streak or 0,
            "best_streak": u.best_login_streak or 0,
            "streak_points": u.streak_points or 0
        })
    
    return {"leaderboard": leaderboard}

@api_router.post("/auth/save-game/{game_id}")
async def save_game(game_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    saved = user.saved_games or []
    if game_id not in saved:
        saved.append(game_id)
        await db.execute(update(User).where(User.id == user.id).values(saved_games=saved))
        await db.commit()
    return {"saved_games": saved}

@api_router.delete("/auth/save-game/{game_id}")
async def unsave_game(game_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    saved = user.saved_games or []
    if game_id in saved:
        saved.remove(game_id)
        await db.execute(update(User).where(User.id == user.id).values(saved_games=saved))
        await db.commit()
    return {"saved_games": saved}

# ==================== GAMES ENDPOINTS ====================

@api_router.get("/games")
async def get_games(
    category: Optional[str] = None,
    visible_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all games with caching"""
    query = select(Game)
    
    if category and category != "all":
        query = query.where(Game.category == category)
    if visible_only:
        query = query.where(Game.is_visible.is_(True))
    
    query = query.order_by(Game.created_at.desc())
    result = await db.execute(query)
    games = result.scalars().all()
    
    game_responses = [GameResponse(**g.to_dict()).model_dump() for g in games]
    
    response = JSONResponse(content=game_responses)
    # Stale-while-revalidate: serve cached content while fetching fresh in background
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    return response

@api_router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    response = JSONResponse(content=GameResponse(**game.to_dict()).model_dump())
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=300"
    return response

@api_router.get("/games/{game_id}/meta")
async def get_game_meta(game_id: str, db: AsyncSession = Depends(get_db)):
    """Lightweight metadata endpoint for SEO"""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    meta = {
        "id": game.id,
        "title": game.title,
        "description": game.description,
        "category": game.category,
        "thumbnail_url": game.thumbnail_url,
        "play_count": game.play_count
    }
    
    response = JSONResponse(content=meta)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return response

@api_router.get("/games/{game_id}/play")
async def get_game_file(game_id: str, db: AsyncSession = Depends(get_db)):
    """Serve game HTML content directly (avoids CSP issues from Supabase Storage redirect)"""
    
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Increment play count (fire and forget - don't block response)
    await db.execute(update(Game).where(Game.id == game_id).values(play_count=Game.play_count + 1))
    await db.commit()
    
    # Handle GamePix games - return embed wrapper with their play URL
    if game.source == "gamepix" and game.embed_url:
        gpx_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>{game.title}</title>
            <link rel="preconnect" href="https://games.gamepix.com">
            <link rel="dns-prefetch" href="https://games.gamepix.com">
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                html, body {{ 
                    width: 100%; 
                    height: 100%; 
                    overflow: hidden;
                    background: #0a0a0a;
                }}
                iframe {{
                    width: 100%;
                    height: 100%;
                    border: none;
                }}
                .loader {{
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #ccff00;
                    font-family: system-ui, sans-serif;
                    font-size: 16px;
                }}
            </style>
        </head>
        <body>
            <div class="loader" id="loader">Loading game...</div>
            <iframe 
                src="{game.embed_url}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; payment"
                allowfullscreen
                onload="document.getElementById('loader').style.display='none'"
            ></iframe>
        </body>
        </html>
        """
        response = HTMLResponse(content=gpx_html, media_type="text/html")
        response.headers["Cache-Control"] = "public, max-age=3600"  # Cache for 1 hour
        return response
    
    # Handle GameDistribution games - return embed wrapper
    if game.source == "gamedistribution" and game.embed_url:
        gd_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>{game.title}</title>
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                html, body {{ 
                    width: 100%; 
                    height: 100%; 
                    overflow: hidden;
                    background: #0a0a0a;
                }}
                iframe {{
                    width: 100%;
                    height: 100%;
                    border: none;
                }}
            </style>
        </head>
        <body>
            <iframe 
                src="{game.embed_url}/?gd_sdk_referrer_url={SUPABASE_URL or ''}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowfullscreen
            ></iframe>
        </body>
        </html>
        """
        return HTMLResponse(content=gd_html, media_type="text/html")
    
    # Try to get game content from Supabase Storage
    if game.game_file_url and supabase_client:
        try:
            # Extract path from URL and download content
            game_path = f"{game_id}/index.html"
            content = download_from_storage(GAMES_BUCKET, game_path)
            if content:
                return HTMLResponse(content=content.decode('utf-8'), media_type="text/html")
        except Exception as e:
            logger.error(f"Error downloading game from storage: {e}")
    
    # Fallback: Get game file from in-memory cache
    if game_id in game_files_cache:
        return HTMLResponse(content=game_files_cache[game_id], media_type="text/html")
    
    # Default HTML if no game file
    default_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>{game.title}</title>
        <style>
            body {{ 
                margin: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                background: #1a1a1a; 
                color: white; 
                font-family: system-ui; 
                text-align: center;
            }}
            .container {{ padding: 2rem; }}
            h1 {{ color: #CCFF00; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>{game.title}</h1>
            <p>{game.description}</p>
            <p style="color: #888; margin-top: 2rem;">Game content loading...</p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=default_html, media_type="text/html")

@api_router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get all unique game categories"""
    result = await db.execute(
        select(Game.category)
        .where(Game.is_visible.is_(True))
        .distinct()
    )
    categories = [row[0] for row in result.all()]
    return {"categories": categories}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/games")
async def admin_get_games(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Get all games for admin (including hidden)"""
    result = await db.execute(select(Game).order_by(Game.created_at.desc()))
    games = result.scalars().all()
    return [GameResponse(**g.to_dict()) for g in games]

@api_router.post("/admin/games/create-with-files")
async def admin_create_game_with_files(
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("Action"),
    preview_type: str = Form("image"),
    thumbnail: UploadFile = File(...),
    game_zip: UploadFile = File(...),
    video_preview: Optional[UploadFile] = File(None),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new game with uploaded files to Supabase Storage"""
    try:
        game_id = str(uuid.uuid4())
        thumbnail_url = None
        game_file_url = None
        video_url = None
        has_game_file = False
        
        # Read all file data
        thumbnail_data = await thumbnail.read()
        zip_data = await game_zip.read()
        video_data = await video_preview.read() if video_preview and preview_type == "video" else None
        
        # Process and upload thumbnail to Supabase Storage
        if supabase_client:
            try:
                # Compress thumbnail
                compressed_thumb = compress_image_bytes(thumbnail_data)
                thumb_path = f"{game_id}/thumbnail.jpg"
                
                # Upload thumbnail
                thumb_upload = upload_to_storage(THUMBNAILS_BUCKET, thumb_path, compressed_thumb, "image/jpeg")
                if thumb_upload:
                    thumbnail_url = thumb_upload
                    logger.info(f"Thumbnail uploaded to Supabase: {thumb_path}")
            except Exception as e:
                logger.error(f"Thumbnail upload error: {e}")
                # Fallback to base64
                thumbnail_url = compress_image(thumbnail_data)
        else:
            # Fallback to base64 if Supabase not available
            thumbnail_url = compress_image(thumbnail_data)
        
        # Process game ZIP file
        try:
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zip_ref:
                # Find and extract index.html
                html_content = None
                for name in zip_ref.namelist():
                    if name.endswith('index.html'):
                        html_content = zip_ref.read(name).decode('utf-8')
                        break
                
                if html_content:
                    if supabase_client:
                        # Upload the HTML content to Supabase Storage
                        game_path = f"{game_id}/index.html"
                        game_upload = upload_to_storage(GAMES_BUCKET, game_path, html_content.encode('utf-8'), "text/html")
                        if game_upload:
                            game_file_url = game_upload
                            has_game_file = True
                            logger.info(f"Game HTML uploaded to Supabase: {game_path}")
                        else:
                            # Fallback to in-memory cache
                            game_files_cache[game_id] = html_content
                            has_game_file = True
                    else:
                        # Store in memory cache
                        game_files_cache[game_id] = html_content
                        has_game_file = True
                        
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file")
        
        # Upload video preview if provided
        if video_data and supabase_client:
            try:
                video_path = f"{game_id}/preview.mp4"
                video_upload = upload_to_storage(PREVIEWS_BUCKET, video_path, video_data, "video/mp4")
                if video_upload:
                    video_url = video_upload
                    logger.info(f"Video preview uploaded to Supabase: {video_path}")
                else:
                    # Fallback to base64 (not recommended for large videos)
                    video_url = f"data:video/mp4;base64,{base64.b64encode(video_data).decode()}"
            except Exception as e:
                logger.error(f"Video upload error: {e}")
                video_url = f"data:video/mp4;base64,{base64.b64encode(video_data).decode()}"
        elif video_data:
            video_url = f"data:video/mp4;base64,{base64.b64encode(video_data).decode()}"
        
        # Create game record
        new_game = Game(
            id=game_id,
            title=title,
            description=description,
            category=category,
            thumbnail_url=thumbnail_url,
            video_preview_url=video_url,
            preview_type=preview_type,
            game_file_url=game_file_url,  # Supabase Storage URL
            has_game_file=has_game_file,
            is_visible=True,
            play_count=0
        )
        
        db.add(new_game)
        await db.commit()
        await db.refresh(new_game)
        
        logger.info(f"Game created: {game_id} - {title}")
        return GameResponse(**new_game.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating game: {e}")
        raise HTTPException(status_code=500, detail="Failed to create game. Please try again.")

@api_router.patch("/admin/games/{game_id}/visibility")
async def admin_toggle_visibility(
    game_id: str,
    visibility: dict,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Toggle game visibility"""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    await db.execute(
        update(Game)
        .where(Game.id == game_id)
        .values(is_visible=visibility.get("is_visible", True))
    )
    await db.commit()
    
    return {"success": True, "is_visible": visibility.get("is_visible", True)}

@api_router.delete("/admin/games/{game_id}")
async def admin_delete_game(
    game_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a game"""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Remove from cache
    if game_id in game_files_cache:
        del game_files_cache[game_id]
    
    await db.execute(delete(Game).where(Game.id == game_id))
    await db.commit()
    
    return {"success": True, "deleted_id": game_id}

@api_router.delete("/admin/games/cleanup/by-source")
async def admin_cleanup_games_by_source(
    source: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete all games from a specific source (gamedistribution, custom, gamepix)"""
    valid_sources = ["gamedistribution", "custom", "gamepix"]
    if source not in valid_sources:
        raise HTTPException(status_code=400, detail=f"Invalid source. Must be one of: {valid_sources}")
    
    # Get games to delete
    if source == "custom":
        # Custom games have source=None or source='custom'
        result = await db.execute(
            select(Game).where(
                (Game.source == None) | (Game.source == "custom")
            )
        )
    else:
        result = await db.execute(select(Game).where(Game.source == source))
    
    games_to_delete = result.scalars().all()
    deleted_ids = [g.id for g in games_to_delete]
    deleted_titles = [g.title for g in games_to_delete]
    
    # Clear from cache
    for game_id in deleted_ids:
        if game_id in game_files_cache:
            del game_files_cache[game_id]
    
    # Delete from database
    if source == "custom":
        await db.execute(
            delete(Game).where(
                (Game.source == None) | (Game.source == "custom")
            )
        )
    else:
        await db.execute(delete(Game).where(Game.source == source))
    
    await db.commit()
    
    logger.info(f"Deleted {len(deleted_ids)} games from source: {source}")
    return {
        "success": True,
        "source": source,
        "deleted_count": len(deleted_ids),
        "deleted_games": deleted_titles
    }

@api_router.delete("/admin/games/cleanup/test-games")
async def admin_cleanup_test_games(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete all test games (titles containing 'Test' or 'test')"""
    result = await db.execute(
        select(Game).where(Game.title.ilike("%test%"))
    )
    
    games_to_delete = result.scalars().all()
    deleted_ids = [g.id for g in games_to_delete]
    deleted_titles = [g.title for g in games_to_delete]
    
    # Clear from cache
    for game_id in deleted_ids:
        if game_id in game_files_cache:
            del game_files_cache[game_id]
    
    # Delete from database
    await db.execute(delete(Game).where(Game.title.ilike("%test%")))
    await db.commit()
    
    logger.info(f"Deleted {len(deleted_ids)} test games")
    return {
        "success": True,
        "deleted_count": len(deleted_ids),
        "deleted_games": deleted_titles
    }

@api_router.post("/admin/seed")
async def admin_seed_games(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Seed sample games"""
    sample_games = [
        {
            "title": "Neon Blocks",
            "description": "Stack falling neon blocks in this addictive puzzle game",
            "category": "Puzzle"
        },
        {
            "title": "Space Dodge",
            "description": "Navigate through asteroid fields in this endless runner",
            "category": "Action"
        },
        {
            "title": "Color Match",
            "description": "Match colors at lightning speed in this reflex game",
            "category": "Arcade"
        },
        {
            "title": "Cyber Runner",
            "description": "Run through a cyberpunk city avoiding obstacles",
            "category": "Racing"
        }
    ]
    
    created = []
    for game_data in sample_games:
        game = Game(
            id=str(uuid.uuid4()),
            title=game_data["title"],
            description=game_data["description"],
            category=game_data["category"],
            is_visible=True,
            play_count=0
        )
        db.add(game)
        created.append(game.title)
    
    await db.commit()
    return {"message": f"Created {len(created)} games", "games": created}

# ==================== ANALYTICS ENDPOINTS ====================

@api_router.post("/analytics/play-session")
async def record_play_session(
    session: PlaySessionCreate,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a play session"""
    new_session = PlaySession(
        id=str(uuid.uuid4()),
        game_id=session.game_id,
        user_id=user.id if user else None,
        duration_seconds=session.duration_seconds,
        score=session.score
    )
    
    db.add(new_session)
    await db.commit()
    
    return {"success": True}

# Old simple analytics moved to advanced analytics section below

# ==================== SETTINGS ENDPOINTS ====================

@api_router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get app settings"""
    result = await db.execute(select(AppSettings))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}

@api_router.post("/admin/settings")
async def update_settings(
    settings_data: dict,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update app settings"""
    for key, value in settings_data.items():
        result = await db.execute(select(AppSettings).where(AppSettings.key == key))
        existing = result.scalar_one_or_none()
        
        if existing:
            await db.execute(
                update(AppSettings)
                .where(AppSettings.key == key)
                .values(value=value)
            )
        else:
            db.add(AppSettings(id=str(uuid.uuid4()), key=key, value=value))
    
    await db.commit()
    return {"success": True}

@api_router.post("/admin/upload-logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
):
    """Upload a logo image"""
    try:
        # Read file content
        content = await file.read()
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1] if file.filename else "png"
        filename = f"logo_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload to Supabase storage
        if supabase_client:
            # Try to delete old logo first
            try:
                supabase_client.storage.from_("game-thumbnails").remove([f"logos/{filename}"])
            except:
                pass
            
            # Upload new logo
            result = supabase_client.storage.from_("game-thumbnails").upload(
                f"logos/{filename}",
                content,
                {"content-type": file.content_type or "image/png"}
            )
            
            # Get public URL
            public_url = supabase_client.storage.from_("game-thumbnails").get_public_url(f"logos/{filename}")
            
            return {"success": True, "url": public_url}
        else:
            raise HTTPException(status_code=500, detail="Storage not configured")
            
    except Exception as e:
        logger.error(f"Error uploading logo: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload logo. Please try again.")

@api_router.post("/admin/upload-favicon")
async def upload_favicon(
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
):
    """Upload a favicon image"""
    try:
        # Read file content
        content = await file.read()
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1] if file.filename else "png"
        filename = f"favicon_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload to Supabase storage
        if supabase_client:
            # Upload new favicon
            result = supabase_client.storage.from_("game-thumbnails").upload(
                f"favicons/{filename}",
                content,
                {"content-type": file.content_type or "image/png"}
            )
            
            # Get public URL
            public_url = supabase_client.storage.from_("game-thumbnails").get_public_url(f"favicons/{filename}")
            
            return {"success": True, "url": public_url}
        else:
            raise HTTPException(status_code=500, detail="Storage not configured")
            
    except Exception as e:
        logger.error(f"Error uploading favicon: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload favicon. Please try again.")

# ==================== GAMEDISTRIBUTION INTEGRATION ====================

class GDGameImport(BaseModel):
    gd_game_id: str
    title: str
    description: Optional[str] = None
    category: str = "Action"
    thumbnail_url: Optional[str] = None
    embed_url: str
    instructions: Optional[str] = None

@api_router.get("/gamedistribution/browse")
async def browse_gamedistribution_games(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None
):
    """Browse games from GameDistribution catalog"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {
                "page": page,
                "per_page": limit,
                "collection": "all",
                "type": "html5"
            }
            
            if category:
                params["category"] = category.lower()
            if search:
                params["search"] = search
            
            # GameDistribution public catalog API
            response = await client.get(
                f"{GD_API_BASE}/games",
                params=params,
                headers={"Accept": "application/json"}
            )
            
            if response.status_code != 200:
                # Return mock data for development/testing
                logger.warning(f"GD API returned {response.status_code}, using mock data")
                return await get_mock_gd_games(category, page, limit)
            
            data = response.json()
            games = data.get("result", [])
            
            # Transform to our format
            transformed_games = []
            for game in games:
                transformed_games.append({
                    "gd_game_id": game.get("md5"),
                    "title": game.get("title"),
                    "description": game.get("description"),
                    "category": game.get("category", "Action"),
                    "thumbnail_url": game.get("assets", {}).get("512x512") or game.get("assets", {}).get("512x340"),
                    "embed_url": f"https://html5.gamedistribution.com/{game.get('md5')}",
                    "instructions": game.get("instructions"),
                    "rating": game.get("rating"),
                    "mobile": game.get("mobile", False)
                })
            
            return {
                "games": transformed_games,
                "total": data.get("total", len(transformed_games)),
                "page": page,
                "limit": limit
            }
            
    except Exception as e:
        logger.error(f"Error browsing GD games: {e}")
        # Return mock data on error
        return await get_mock_gd_games(category, page, limit)

async def get_mock_gd_games(category: Optional[str], page: int, limit: int):
    """Return mock GameDistribution games for development"""
    mock_games = [
        {
            "gd_game_id": "gd-puzzle-blocks-1",
            "title": "Puzzle Blocks",
            "description": "A classic block puzzle game. Match colors to clear the board!",
            "category": "Puzzle",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/puzzle-blocks.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/ca6c2f38f3fc4aa192ec10dab6e77f2b/",
            "instructions": "Click and drag blocks to match colors",
            "mobile": True
        },
        {
            "gd_game_id": "gd-space-shooter-1",
            "title": "Space Shooter",
            "description": "Defend Earth from alien invaders in this action-packed shooter!",
            "category": "Action",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/space-shooter.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/bf0f09e63a9447e5a3d2c6c8e93d8f8e/",
            "instructions": "Use arrow keys to move, space to shoot",
            "mobile": True
        },
        {
            "gd_game_id": "gd-racing-master-1",
            "title": "Racing Master",
            "description": "Race against time in this high-speed racing game!",
            "category": "Racing",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/racing-master.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9/",
            "instructions": "Use arrow keys to steer, avoid obstacles",
            "mobile": True
        },
        {
            "gd_game_id": "gd-candy-crush-1",
            "title": "Candy Match",
            "description": "Match colorful candies in this sweet puzzle game!",
            "category": "Puzzle",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/candy-match.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/",
            "instructions": "Swap candies to match 3 or more",
            "mobile": True
        },
        {
            "gd_game_id": "gd-zombie-run-1",
            "title": "Zombie Runner",
            "description": "Run for your life! Escape the zombie apocalypse!",
            "category": "Action",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/zombie-runner.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0/",
            "instructions": "Tap or click to jump over obstacles",
            "mobile": True
        },
        {
            "gd_game_id": "gd-word-wizard-1",
            "title": "Word Wizard",
            "description": "Test your vocabulary in this word puzzle challenge!",
            "category": "Puzzle",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/word-wizard.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1/",
            "instructions": "Find hidden words in the letter grid",
            "mobile": True
        },
        {
            "gd_game_id": "gd-basketball-star-1",
            "title": "Basketball Star",
            "description": "Shoot hoops and become the basketball champion!",
            "category": "Sports",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/basketball-star.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2/",
            "instructions": "Swipe to aim and shoot the basketball",
            "mobile": True
        },
        {
            "gd_game_id": "gd-tower-defense-1",
            "title": "Tower Defense Pro",
            "description": "Build towers and defend your base from waves of enemies!",
            "category": "Strategy",
            "thumbnail_url": "https://img.gamedistribution.com/512x512/tower-defense.jpg",
            "embed_url": "https://html5.gamedistribution.com/rvvASMiM/b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3/",
            "instructions": "Place towers strategically to stop enemies",
            "mobile": True
        }
    ]
    
    # Filter by category if provided
    if category:
        mock_games = [g for g in mock_games if g["category"].lower() == category.lower()]
    
    # Paginate
    start = (page - 1) * limit
    end = start + limit
    paginated = mock_games[start:end]
    
    return {
        "games": paginated,
        "total": len(mock_games),
        "page": page,
        "limit": limit
    }

@api_router.get("/gamedistribution/categories")
async def get_gd_categories():
    """Get available GameDistribution game categories"""
    categories = [
        {"id": "action", "name": "Action", "icon": "⚔️"},
        {"id": "arcade", "name": "Arcade", "icon": "🕹️"},
        {"id": "puzzle", "name": "Puzzle", "icon": "🧩"},
        {"id": "racing", "name": "Racing", "icon": "🏎️"},
        {"id": "sports", "name": "Sports", "icon": "⚽"},
        {"id": "strategy", "name": "Strategy", "icon": "♟️"},
        {"id": "adventure", "name": "Adventure", "icon": "🗺️"},
        {"id": "shooting", "name": "Shooting", "icon": "🎯"},
        {"id": "multiplayer", "name": "Multiplayer", "icon": "👥"},
        {"id": "io", "name": ".io Games", "icon": "🌐"}
    ]
    return {"categories": categories}

@api_router.post("/admin/gamedistribution/import")
async def import_gd_game(
    game_data: GDGameImport,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Import a game from GameDistribution into our platform"""
    try:
        # Check if game already exists
        result = await db.execute(
            select(Game).where(Game.gd_game_id == game_data.gd_game_id)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(status_code=400, detail="Game already imported")
        
        # Create new game
        new_game = Game(
            id=str(uuid.uuid4()),
            title=game_data.title,
            description=game_data.description or "",
            category=game_data.category,
            thumbnail_url=game_data.thumbnail_url,
            embed_url=game_data.embed_url,
            gd_game_id=game_data.gd_game_id,
            source="gamedistribution",
            instructions=game_data.instructions,
            has_game_file=True,  # GD games are always playable
            is_visible=True,
            play_count=0
        )
        
        db.add(new_game)
        await db.commit()
        await db.refresh(new_game)
        
        logger.info(f"Imported GD game: {new_game.title} ({new_game.gd_game_id})")
        return GameResponse(**new_game.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing GD game: {e}")
        raise HTTPException(status_code=500, detail="Failed to import game. Please try again.")

@api_router.post("/admin/gamedistribution/bulk-import")
async def bulk_import_gd_games(
    games: List[GDGameImport],
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk import games from GameDistribution"""
    imported = []
    skipped = []
    
    for game_data in games:
        try:
            # Check if game already exists
            result = await db.execute(
                select(Game).where(Game.gd_game_id == game_data.gd_game_id)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                skipped.append(game_data.title)
                continue
            
            # Create new game
            new_game = Game(
                id=str(uuid.uuid4()),
                title=game_data.title,
                description=game_data.description or "",
                category=game_data.category,
                thumbnail_url=game_data.thumbnail_url,
                embed_url=game_data.embed_url,
                gd_game_id=game_data.gd_game_id,
                source="gamedistribution",
                instructions=game_data.instructions,
                has_game_file=True,
                is_visible=True,
                play_count=0
            )
            
            db.add(new_game)
            imported.append(game_data.title)
            
        except Exception as e:
            logger.error(f"Error importing {game_data.title}: {e}")
            skipped.append(game_data.title)
    
    await db.commit()
    
    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "imported_games": imported,
        "skipped_games": skipped
    }

# ==================== GAMEPIX INTEGRATION ====================

# GamePix Configuration
GAMEPIX_SID = "1M9DD"  # Publisher SID for stats tracking
GAMEPIX_FEED_BASE = "https://feeds.gamepix.com/v2/json"

class GPXGameImport(BaseModel):
    gpx_game_id: str
    title: str
    namespace: str
    description: Optional[str] = None
    category: str = "Action"
    thumbnail_url: Optional[str] = None  # banner_image
    icon_url: Optional[str] = None  # image
    play_url: str  # url from feed
    orientation: Optional[str] = None
    quality_score: Optional[float] = None

@api_router.get("/gamepix/browse")
async def browse_gamepix_games(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    order: str = "quality"  # 'quality' or 'pubdate' (newest first)
):
    """Browse games from GamePix RSS feed with sorting"""
    try:
        # GamePix only allows specific pagination values: 12, 24, 48, 96
        allowed_limits = [12, 24, 48, 96]
        gpx_limit = min([l for l in allowed_limits if l >= limit], default=96)
        
        # Validate order parameter
        valid_orders = ["quality", "pubdate"]
        if order not in valid_orders:
            order = "quality"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {
                "sid": GAMEPIX_SID,
                "pagination": gpx_limit,
                "page": page,
                "order": order  # Add sorting parameter
            }
            
            if category and category.lower() != "all":
                params["category"] = category.lower()
            
            response = await client.get(GAMEPIX_FEED_BASE, params=params)
            
            if response.status_code != 200:
                logger.warning(f"GamePix API returned {response.status_code}: {response.text[:200]}")
                return {"games": [], "total": 0, "page": page, "limit": limit, "error": "Failed to fetch games"}
            
            data = response.json()
            items = data.get("items", [])
            
            # Transform to our format
            transformed_games = []
            for game in items:
                transformed_games.append({
                    "gpx_game_id": game.get("id"),
                    "title": game.get("title"),
                    "namespace": game.get("namespace"),
                    "description": game.get("description"),
                    "category": game.get("category", "Action"),
                    "thumbnail_url": game.get("banner_image"),
                    "icon_url": game.get("image"),
                    "play_url": game.get("url"),
                    "orientation": game.get("orientation"),
                    "quality_score": game.get("quality_score"),
                    "date_published": game.get("date_published")
                })
            
            return {
                "games": transformed_games,
                "total": len(items),  # GamePix doesn't provide total count
                "page": page,
                "limit": limit,
                "next_url": data.get("next_url"),
                "previous_url": data.get("previous_url"),
                "has_more": data.get("next_url") is not None
            }
            
    except Exception as e:
        logger.error(f"Error browsing GamePix games: {e}")
        return {"games": [], "total": 0, "page": page, "limit": limit, "error": str(e)}

@api_router.get("/gamepix/categories")
async def get_gamepix_categories():
    """Get available GamePix game categories"""
    categories = [
        {"id": "all", "name": "All Games", "icon": "🎮"},
        {"id": "action", "name": "Action", "icon": "⚔️"},
        {"id": "adventure", "name": "Adventure", "icon": "🗺️"},
        {"id": "arcade", "name": "Arcade", "icon": "🕹️"},
        {"id": "puzzle", "name": "Puzzle", "icon": "🧩"},
        {"id": "racing", "name": "Racing", "icon": "🏎️"},
        {"id": "sports", "name": "Sports", "icon": "⚽"},
        {"id": "strategy", "name": "Strategy", "icon": "♟️"},
        {"id": "shooting", "name": "Shooting", "icon": "🎯"},
        {"id": "board", "name": "Board", "icon": "🎲"},
        {"id": "cards", "name": "Cards", "icon": "🃏"},
        {"id": "casino", "name": "Casino", "icon": "🎰"},
        {"id": "casual", "name": "Casual", "icon": "🎈"},
        {"id": "educational", "name": "Educational", "icon": "📚"},
        {"id": "girls", "name": "Girls", "icon": "👗"},
        {"id": "kids", "name": "Kids", "icon": "🧸"},
        {"id": "multiplayer", "name": "Multiplayer", "icon": "👥"},
        {"id": "quiz", "name": "Quiz", "icon": "❓"},
        {"id": "simulation", "name": "Simulation", "icon": "🏠"},
        {"id": "word", "name": "Word", "icon": "📝"}
    ]
    return {"categories": categories}

@api_router.post("/admin/gamepix/import")
async def import_gamepix_game(
    game_data: GPXGameImport,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Import a game from GamePix into our platform"""
    try:
        # Check if game already exists by namespace (unique identifier)
        result = await db.execute(
            select(Game).where(Game.gd_game_id == f"gpx-{game_data.namespace}")
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(status_code=400, detail="Game already imported")
        
        # Create new game with both banner (thumbnail) and icon images
        new_game = Game(
            id=str(uuid.uuid4()),
            title=game_data.title,
            description=game_data.description or "",
            category=game_data.category.title() if game_data.category else "Action",
            thumbnail_url=game_data.thumbnail_url,  # Banner image (landscape)
            icon_url=game_data.icon_url,  # Square icon image
            embed_url=game_data.play_url,  # GamePix provides direct play URL
            gd_game_id=f"gpx-{game_data.namespace}",  # Prefix with gpx- to distinguish
            source="gamepix",
            has_game_file=True,  # GamePix games are always playable via URL
            is_visible=True,
            play_count=0
        )
        
        db.add(new_game)
        await db.commit()
        await db.refresh(new_game)
        
        logger.info(f"Imported GamePix game: {new_game.title} ({game_data.namespace})")
        return GameResponse(**new_game.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing GamePix game: {e}")
        raise HTTPException(status_code=500, detail="Failed to import game. Please try again.")

@api_router.post("/admin/gamepix/bulk-import")
async def bulk_import_gamepix_games(
    games: List[GPXGameImport],
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk import games from GamePix"""
    imported = []
    skipped = []
    
    for game_data in games:
        try:
            # Check if game already exists
            result = await db.execute(
                select(Game).where(Game.gd_game_id == f"gpx-{game_data.namespace}")
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                skipped.append(game_data.title)
                continue
            
            # Create new game with both banner and icon images
            new_game = Game(
                id=str(uuid.uuid4()),
                title=game_data.title,
                description=game_data.description or "",
                category=game_data.category.title() if game_data.category else "Action",
                thumbnail_url=game_data.thumbnail_url,  # Banner image
                icon_url=game_data.icon_url,  # Square icon
                embed_url=game_data.play_url,
                gd_game_id=f"gpx-{game_data.namespace}",
                source="gamepix",
                has_game_file=True,
                is_visible=True,
                play_count=0
            )
            
            db.add(new_game)
            imported.append(game_data.title)
            
        except Exception as e:
            logger.error(f"Error importing {game_data.title}: {e}")
            skipped.append(game_data.title)
    
    await db.commit()
    
    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "imported_games": imported,
        "skipped_games": skipped
    }

# ==================== SOCIAL FEATURES ====================

# Pydantic models for social features
class FriendRequest(BaseModel):
    user_id: str

class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    challenge_type: str = "daily"  # daily, weekly, friend
    target_type: str = "plays"  # plays, score, time, games_played
    target_value: int
    game_id: Optional[str] = None
    friend_id: Optional[str] = None  # For friend challenges
    ends_at: Optional[str] = None

class ScoreSubmission(BaseModel):
    game_id: str
    score: int
    play_time: int = 0  # seconds

# ---- User Search ----

@api_router.get("/users/search")
async def search_users(
    q: str,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search for users by username"""
    if len(q) < 2:
        return {"users": []}
    
    result = await db.execute(
        select(User)
        .where(User.username.ilike(f"%{q}%"))
        .where(User.id != user.id)  # Exclude current user
        .limit(limit)
    )
    users = result.scalars().all()
    
    # Get friendship status for each user
    users_with_status = []
    for u in users:
        # Check if there's an existing friendship
        friendship = await db.execute(
            select(Friendship).where(
                or_(
                    and_(Friendship.requester_id == user.id, Friendship.addressee_id == u.id),
                    and_(Friendship.requester_id == u.id, Friendship.addressee_id == user.id)
                )
            )
        )
        f = friendship.scalar_one_or_none()
        
        status = "none"
        if f:
            if f.status == FriendshipStatus.ACCEPTED:
                status = "friends"
            elif f.status == FriendshipStatus.PENDING:
                if f.requester_id == user.id:
                    status = "pending_sent"
                else:
                    status = "pending_received"
        
        users_with_status.append({
            **u.to_dict(),
            "friendship_status": status
        })
    
    return {"users": users_with_status}

# ---- Friends ----

@api_router.get("/friends")
async def get_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's friends list"""
    # Get accepted friendships where user is either requester or addressee
    result = await db.execute(
        select(Friendship).where(
            and_(
                or_(
                    Friendship.requester_id == user.id,
                    Friendship.addressee_id == user.id
                ),
                Friendship.status == FriendshipStatus.ACCEPTED
            )
        )
    )
    friendships = result.scalars().all()
    
    friends = []
    for f in friendships:
        friend_id = f.addressee_id if f.requester_id == user.id else f.requester_id
        friend_result = await db.execute(select(User).where(User.id == friend_id))
        friend = friend_result.scalar_one_or_none()
        if friend:
            friends.append(friend.to_dict())
    
    return {"friends": friends}

@api_router.get("/friends/requests")
async def get_friend_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get pending friend requests"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.addressee_id == user.id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
    )
    requests = result.scalars().all()
    
    pending = []
    for r in requests:
        requester_result = await db.execute(select(User).where(User.id == r.requester_id))
        requester = requester_result.scalar_one_or_none()
        if requester:
            pending.append({
                "request_id": r.id,
                "user": requester.to_dict(),
                "created_at": r.created_at.isoformat()
            })
    
    return {"requests": pending}

@api_router.post("/friends/request")
async def send_friend_request(
    request: FriendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a friend request"""
    if request.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    
    # Check if target user exists
    result = await db.execute(select(User).where(User.id == request.user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for existing friendship
    existing = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == request.user_id),
                and_(Friendship.requester_id == request.user_id, Friendship.addressee_id == user.id)
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Friendship already exists or pending")
    
    # Create friend request
    friendship = Friendship(
        requester_id=user.id,
        addressee_id=request.user_id,
        status=FriendshipStatus.PENDING
    )
    db.add(friendship)
    await db.commit()
    
    return {"success": True, "message": "Friend request sent"}

@api_router.post("/friends/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a friend request"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.id == request_id,
                Friendship.addressee_id == user.id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    friendship.status = FriendshipStatus.ACCEPTED
    friendship.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"success": True, "message": "Friend request accepted"}

@api_router.post("/friends/decline/{request_id}")
async def decline_friend_request(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Decline a friend request"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.id == request_id,
                Friendship.addressee_id == user.id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    friendship.status = FriendshipStatus.DECLINED
    friendship.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"success": True, "message": "Friend request declined"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(
    friend_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a friend"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                or_(
                    and_(Friendship.requester_id == user.id, Friendship.addressee_id == friend_id),
                    and_(Friendship.requester_id == friend_id, Friendship.addressee_id == user.id)
                ),
                Friendship.status == FriendshipStatus.ACCEPTED
            )
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    await db.delete(friendship)
    await db.commit()
    
    return {"success": True, "message": "Friend removed"}

# ---- Leaderboards ----

@api_router.get("/leaderboard/global")
async def get_global_leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get global leaderboard (top players by total play time and games)"""
    # Check cache first
    cached = get_leaderboard("global")
    if cached:
        return {"leaderboard": cached, "cached": True}
    
    result = await db.execute(
        select(User)
        .order_by(desc(User.total_games_played), desc(User.total_play_time))
        .limit(limit)
    )
    users = result.scalars().all()
    
    leaderboard = []
    for i, u in enumerate(users, 1):
        leaderboard.append({
            "rank": i,
            "user": u.to_dict(),
            "total_games": u.total_games_played or 0,
            "total_time": u.total_play_time or 0
        })
    
    # Cache the result
    set_leaderboard(leaderboard, "global")
    
    return {"leaderboard": leaderboard, "cached": False}

@api_router.get("/leaderboard/game/{game_id}")
async def get_game_leaderboard(
    game_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard for a specific game"""
    # Check cache first
    cached = get_leaderboard("game", game_id)
    if cached:
        return {"leaderboard": cached, "cached": True}
    
    # Get high scores from users for this game
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    scores = []
    for u in users:
        if u.high_scores and game_id in u.high_scores:
            scores.append({
                "user": u.to_dict(),
                "score": u.high_scores[game_id]
            })
    
    # Sort by score descending
    scores.sort(key=lambda x: x["score"], reverse=True)
    scores = scores[:limit]
    
    # Add ranks
    leaderboard = [{"rank": i + 1, **s} for i, s in enumerate(scores)]
    
    # Cache the result
    set_leaderboard(leaderboard, "game", game_id)
    
    return {"leaderboard": leaderboard, "cached": False}

@api_router.post("/leaderboard/submit")
async def submit_score(
    submission: ScoreSubmission,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a score for a game"""
    # Update user's high score if this is higher
    high_scores = user.high_scores or {}
    current_high = high_scores.get(submission.game_id, 0)
    
    if submission.score > current_high:
        high_scores[submission.game_id] = submission.score
        user.high_scores = high_scores
    
    # Update play stats
    user.total_games_played = (user.total_games_played or 0) + 1
    user.total_play_time = (user.total_play_time or 0) + submission.play_time
    user.last_active_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Invalidate leaderboard cache
    invalidate_leaderboard(submission.game_id)
    invalidate_leaderboard()
    
    return {
        "success": True,
        "new_high_score": submission.score > current_high,
        "high_score": high_scores.get(submission.game_id, submission.score)
    }

# ---- Challenges ----

@api_router.get("/challenges")
async def get_challenges(
    challenge_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active challenges"""
    now = datetime.now(timezone.utc)
    
    query = select(Challenge).where(
        and_(
            Challenge.status == ChallengeStatus.ACTIVE,
            or_(Challenge.ends_at.is_(None), Challenge.ends_at > now)
        )
    )
    
    if challenge_type:
        query = query.where(Challenge.challenge_type == ChallengeType(challenge_type))
    
    result = await db.execute(query.order_by(desc(Challenge.created_at)))
    challenges = result.scalars().all()
    
    # Get user's progress for each challenge
    challenges_with_progress = []
    for c in challenges:
        participation = await db.execute(
            select(ChallengeParticipant).where(
                and_(
                    ChallengeParticipant.challenge_id == c.id,
                    ChallengeParticipant.user_id == user.id
                )
            )
        )
        participant = participation.scalar_one_or_none()
        
        challenge_data = c.to_dict()
        challenge_data["joined"] = participant is not None
        challenge_data["progress"] = participant.progress if participant else 0
        challenge_data["completed"] = participant.completed if participant else False
        challenges_with_progress.append(challenge_data)
    
    return {"challenges": challenges_with_progress}

@api_router.post("/challenges/join/{challenge_id}")
async def join_challenge(
    challenge_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a challenge"""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Check if already joined
    existing = await db.execute(
        select(ChallengeParticipant).where(
            and_(
                ChallengeParticipant.challenge_id == challenge_id,
                ChallengeParticipant.user_id == user.id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already joined this challenge")
    
    participant = ChallengeParticipant(
        challenge_id=challenge_id,
        user_id=user.id,
        progress=0,
        completed=False
    )
    db.add(participant)
    await db.commit()
    
    return {"success": True, "message": "Joined challenge"}

@api_router.post("/challenges/create")
async def create_challenge(
    challenge_data: ChallengeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new challenge (friend challenges)"""
    ends_at = None
    if challenge_data.ends_at:
        ends_at = datetime.fromisoformat(challenge_data.ends_at.replace('Z', '+00:00'))
    elif challenge_data.challenge_type == "daily":
        ends_at = datetime.now(timezone.utc) + timedelta(days=1)
    elif challenge_data.challenge_type == "weekly":
        ends_at = datetime.now(timezone.utc) + timedelta(weeks=1)
    
    challenge = Challenge(
        title=challenge_data.title,
        description=challenge_data.description,
        challenge_type=ChallengeType(challenge_data.challenge_type),
        status=ChallengeStatus.ACTIVE,
        target_type=challenge_data.target_type,
        target_value=challenge_data.target_value,
        game_id=challenge_data.game_id,
        creator_id=user.id,
        ends_at=ends_at
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    
    # Auto-join creator
    participant = ChallengeParticipant(
        challenge_id=challenge.id,
        user_id=user.id,
        progress=0,
        completed=False
    )
    db.add(participant)
    
    # If friend challenge, add the friend
    if challenge_data.friend_id:
        friend_participant = ChallengeParticipant(
            challenge_id=challenge.id,
            user_id=challenge_data.friend_id,
            progress=0,
            completed=False
        )
        db.add(friend_participant)
    
    await db.commit()
    
    return {"success": True, "challenge": challenge.to_dict()}

# ---- Admin: Create system challenges ----

@api_router.post("/admin/challenges/create")
async def admin_create_challenge(
    challenge_data: ChallengeCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Create a system challenge (daily/weekly)"""
    ends_at = None
    if challenge_data.ends_at:
        ends_at = datetime.fromisoformat(challenge_data.ends_at.replace('Z', '+00:00'))
    elif challenge_data.challenge_type == "daily":
        ends_at = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)
    elif challenge_data.challenge_type == "weekly":
        ends_at = datetime.now(timezone.utc) + timedelta(days=7 - datetime.now(timezone.utc).weekday())
    
    challenge = Challenge(
        title=challenge_data.title,
        description=challenge_data.description,
        challenge_type=ChallengeType(challenge_data.challenge_type),
        status=ChallengeStatus.ACTIVE,
        target_type=challenge_data.target_type,
        target_value=challenge_data.target_value,
        game_id=challenge_data.game_id,
        reward_points=100 if challenge_data.challenge_type == "daily" else 500,
        ends_at=ends_at
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    
    return {"success": True, "challenge": challenge.to_dict()}

# ==================== ANALYTICS ====================

@api_router.get("/admin/analytics/overview")
async def get_analytics_overview(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive analytics overview"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    
    # Total stats
    total_users = await db.execute(select(func.count(User.id)))
    total_games = await db.execute(select(func.count(Game.id)).where(Game.is_visible.is_(True)))
    total_plays = await db.execute(select(func.sum(Game.play_count)))
    
    # Today's stats
    new_users_today = await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    plays_today = await db.execute(
        select(func.count(PlaySession.id)).where(PlaySession.played_at >= today_start)
    )
    
    # Active users (played in last 24 hours)
    active_users = await db.execute(
        select(func.count(func.distinct(PlaySession.user_id))).where(
            PlaySession.played_at >= now - timedelta(hours=24)
        )
    )
    
    # This week
    plays_this_week = await db.execute(
        select(func.count(PlaySession.id)).where(PlaySession.played_at >= week_start)
    )
    
    # Top games
    top_games_result = await db.execute(
        select(Game).where(Game.is_visible.is_(True)).order_by(desc(Game.play_count)).limit(10)
    )
    top_games = [{"id": g.id, "title": g.title, "plays": g.play_count} for g in top_games_result.scalars().all()]
    
    # Category breakdown
    category_result = await db.execute(
        select(Game.category, func.sum(Game.play_count).label("plays"))
        .where(Game.is_visible.is_(True))
        .group_by(Game.category)
        .order_by(desc("plays"))
    )
    categories = [{"category": c[0], "plays": c[1] or 0} for c in category_result.all()]
    
    return {
        "overview": {
            "total_users": total_users.scalar() or 0,
            "total_games": total_games.scalar() or 0,
            "total_plays": total_plays.scalar() or 0,
            "new_users_today": new_users_today.scalar() or 0,
            "plays_today": plays_today.scalar() or 0,
            "active_users_24h": active_users.scalar() or 0,
            "plays_this_week": plays_this_week.scalar() or 0
        },
        "top_games": top_games,
        "categories": categories,
        "redis_status": "connected" if is_redis_available() else "not configured"
    }

@api_router.get("/admin/analytics/daily")
async def get_daily_analytics(
    days: int = 30,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get daily analytics for the last N days"""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    daily_data = []
    
    for i in range(days):
        day = start_date + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        # Plays for this day
        plays = await db.execute(
            select(func.count(PlaySession.id)).where(
                and_(
                    PlaySession.played_at >= day_start,
                    PlaySession.played_at < day_end
                )
            )
        )
        
        # Unique players
        unique_players = await db.execute(
            select(func.count(func.distinct(PlaySession.user_id))).where(
                and_(
                    PlaySession.played_at >= day_start,
                    PlaySession.played_at < day_end
                )
            )
        )
        
        # New users
        new_users = await db.execute(
            select(func.count(User.id)).where(
                and_(
                    User.created_at >= day_start,
                    User.created_at < day_end
                )
            )
        )
        
        daily_data.append({
            "date": day_start.isoformat(),
            "plays": plays.scalar() or 0,
            "unique_players": unique_players.scalar() or 0,
            "new_users": new_users.scalar() or 0
        })
    
    return {"daily_stats": daily_data}

@api_router.get("/admin/analytics/retention")
async def get_retention_analytics(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get user retention analytics"""
    now = datetime.now(timezone.utc)
    
    # Users who signed up in the last 7 days
    week_ago = now - timedelta(days=7)
    
    result = await db.execute(
        select(User).where(User.created_at >= week_ago)
    )
    new_users = result.scalars().all()
    
    retention_data = {
        "day_1": 0,
        "day_3": 0,
        "day_7": 0,
        "total_new_users": len(new_users)
    }
    
    for u in new_users:
        signup_date = u.created_at
        
        # Check if user played after day 1, 3, 7
        for days, key in [(1, "day_1"), (3, "day_3"), (7, "day_7")]:
            check_date = signup_date + timedelta(days=days)
            if check_date > now:
                continue
                
            played = await db.execute(
                select(PlaySession).where(
                    and_(
                        PlaySession.user_id == u.id,
                        PlaySession.played_at >= check_date,
                        PlaySession.played_at < check_date + timedelta(days=1)
                    )
                ).limit(1)
            )
            if played.scalar_one_or_none():
                retention_data[key] += 1
    
    # Calculate percentages
    if retention_data["total_new_users"] > 0:
        for key in ["day_1", "day_3", "day_7"]:
            retention_data[f"{key}_pct"] = round(
                retention_data[key] / retention_data["total_new_users"] * 100, 1
            )
    
    return {"retention": retention_data}


@api_router.get("/admin/analytics/regions")
async def get_region_analytics(
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get geographic distribution of users/plays"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get region data from analytics events
    since_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Query events with region data
    result = await db.execute(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.timestamp >= since_date)
        .where(AnalyticsEvent.event_data['region'].isnot(None))
    )
    events = result.scalars().all()
    
    # Aggregate by region
    region_counts = {}
    for event in events:
        region = event.event_data.get('region') or event.event_data.get('country')
        if region:
            region_counts[region] = region_counts.get(region, 0) + 1
    
    # Also get user registration regions from User table if available
    user_result = await db.execute(select(User))
    users = user_result.scalars().all()
    
    user_regions = {}
    for u in users:
        # Check if user has region in their data
        region = None
        if hasattr(u, 'region') and u.region:
            region = u.region
        if region:
            user_regions[region] = user_regions.get(region, 0) + 1
    
    # Sort regions by count
    sorted_regions = sorted(region_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Format for frontend
    regions_data = [
        {"region": region, "events": count}
        for region, count in sorted_regions[:20]  # Top 20 regions
    ]
    
    # If no region data from events, return sample/demo data
    if not regions_data:
        # Return demo data to show the chart works
        regions_data = [
            {"region": "United States", "events": 0},
            {"region": "United Kingdom", "events": 0},
            {"region": "Germany", "events": 0},
            {"region": "France", "events": 0},
            {"region": "Canada", "events": 0},
        ]
    
    return {
        "regions": regions_data,
        "total_events_with_region": sum(r["events"] for r in regions_data),
        "period_days": days
    }


@api_router.get("/admin/analytics/devices")
async def get_device_stats(
    days: int = 30,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get device statistics from analytics events"""
    since_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Query events with device data
    result = await db.execute(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.timestamp >= since_date)
    )
    events = result.scalars().all()
    
    # Aggregate device stats
    device_types = {}
    browsers = {}
    os_stats = {}
    screen_sizes = {}
    
    for event in events:
        data = event.event_data or {}
        
        # Device type
        device = data.get('device_type', 'Unknown')
        device_types[device] = device_types.get(device, 0) + 1
        
        # Browser
        browser = data.get('browser', 'Unknown')
        if browser != 'Unknown':
            browsers[browser] = browsers.get(browser, 0) + 1
        
        # OS
        os_name = data.get('os', 'Unknown')
        if os_name != 'Unknown':
            os_stats[os_name] = os_stats.get(os_name, 0) + 1
        
        # Screen size category
        screen = data.get('screen_category', 'Unknown')
        if screen != 'Unknown':
            screen_sizes[screen] = screen_sizes.get(screen, 0) + 1
    
    # Sort by count and format
    def sort_and_format(data_dict, limit=10):
        sorted_items = sorted(data_dict.items(), key=lambda x: x[1], reverse=True)
        return [{"name": k, "count": v} for k, v in sorted_items[:limit]]
    
    # Calculate percentages for device types
    total_events = sum(device_types.values()) or 1
    device_breakdown = []
    for name, count in sorted(device_types.items(), key=lambda x: x[1], reverse=True):
        device_breakdown.append({
            "name": name,
            "count": count,
            "percentage": round(count / total_events * 100, 1)
        })
    
    return {
        "device_types": device_breakdown,
        "browsers": sort_and_format(browsers),
        "operating_systems": sort_and_format(os_stats),
        "screen_sizes": sort_and_format(screen_sizes),
        "total_events": total_events,
        "period_days": days
    }


@api_router.post("/analytics/track")
async def track_analytics_with_region(
    request: Request,
    event_type: str = Form(...),
    game_id: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    device_type: Optional[str] = Form(None),
    browser: Optional[str] = Form(None),
    os: Optional[str] = Form(None),
    screen_width: Optional[int] = Form(None),
    screen_height: Optional[int] = Form(None),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Track an analytics event with region and device data"""
    event_data = {}
    
    # Region data
    if region:
        event_data['region'] = region
    if country:
        event_data['country'] = country
    
    # Device data
    if device_type:
        event_data['device_type'] = device_type
    if browser:
        event_data['browser'] = browser
    if os:
        event_data['os'] = os
    if screen_width and screen_height:
        event_data['screen_width'] = screen_width
        event_data['screen_height'] = screen_height
        # Categorize screen size
        if screen_width < 768:
            event_data['screen_category'] = 'Mobile'
        elif screen_width < 1024:
            event_data['screen_category'] = 'Tablet'
        elif screen_width < 1440:
            event_data['screen_category'] = 'Laptop'
        else:
            event_data['screen_category'] = 'Desktop'
    
    # Try to get country from Cloudflare/Vercel headers if available
    cf_country = request.headers.get('CF-IPCountry')
    vercel_country = request.headers.get('X-Vercel-IP-Country')
    
    if cf_country and not event_data.get('country'):
        event_data['country'] = cf_country
        event_data['region'] = cf_country
    elif vercel_country and not event_data.get('country'):
        event_data['country'] = vercel_country
        event_data['region'] = vercel_country
    
    # Parse user agent if device info not provided
    user_agent = request.headers.get('User-Agent', '')
    if user_agent and not device_type:
        ua_lower = user_agent.lower()
        if 'mobile' in ua_lower or 'android' in ua_lower or 'iphone' in ua_lower:
            event_data['device_type'] = 'Mobile'
        elif 'tablet' in ua_lower or 'ipad' in ua_lower:
            event_data['device_type'] = 'Tablet'
        else:
            event_data['device_type'] = 'Desktop'
        
        # Basic browser detection
        if not browser:
            if 'chrome' in ua_lower and 'edg' not in ua_lower:
                event_data['browser'] = 'Chrome'
            elif 'firefox' in ua_lower:
                event_data['browser'] = 'Firefox'
            elif 'safari' in ua_lower and 'chrome' not in ua_lower:
                event_data['browser'] = 'Safari'
            elif 'edg' in ua_lower:
                event_data['browser'] = 'Edge'
            elif 'opera' in ua_lower:
                event_data['browser'] = 'Opera'
        
        # Basic OS detection
        if not os:
            if 'windows' in ua_lower:
                event_data['os'] = 'Windows'
            elif 'mac os' in ua_lower or 'macos' in ua_lower:
                event_data['os'] = 'macOS'
            elif 'android' in ua_lower:
                event_data['os'] = 'Android'
            elif 'iphone' in ua_lower or 'ipad' in ua_lower:
                event_data['os'] = 'iOS'
            elif 'linux' in ua_lower:
                event_data['os'] = 'Linux'
    
    event = AnalyticsEvent(
        event_type=event_type,
        user_id=user.id if user else None,
        game_id=game_id,
        event_data=event_data
    )
    db.add(event)
    await db.commit()
    
    return {"success": True}


@api_router.post("/analytics/event")
async def track_event(
    event_type: str,
    game_id: Optional[str] = None,
    event_data: Optional[dict] = None,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Track an analytics event"""
    event = AnalyticsEvent(
        event_type=event_type,
        user_id=user.id if user else None,
        game_id=game_id,
        event_data=event_data or {}
    )
    db.add(event)
    await db.commit()
    
    return {"success": True}


# ==================== ADMIN USER MANAGEMENT ====================

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    is_admin: Optional[bool] = None
    is_banned: Optional[bool] = None
    ban_reason: Optional[str] = None
    bio: Optional[str] = None


@api_router.get("/admin/users")
async def admin_get_users(
    search: Optional[str] = None,
    is_admin: Optional[bool] = None,
    is_banned: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 20,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all users with filtering, sorting, and pagination"""
    query = select(User)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term)
            )
        )
    
    if is_admin is not None:
        query = query.where(User.is_admin == is_admin)
    
    if is_banned is not None:
        query = query.where(User.is_banned == is_banned)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply sorting
    sort_column = getattr(User, sort_by, User.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)
    
    # Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return {
        "users": [u.to_dict(include_private=True) for u in users],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@api_router.get("/admin/users/{user_id}")
async def admin_get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed user information"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's play sessions count
    sessions_result = await db.execute(
        select(func.count(PlaySession.id)).where(PlaySession.user_id == user_id)
    )
    total_sessions = sessions_result.scalar() or 0
    
    # Get user's recent activity
    recent_activity = await db.execute(
        select(PlaySession)
        .where(PlaySession.user_id == user_id)
        .order_by(desc(PlaySession.played_at))
        .limit(10)
    )
    recent_sessions = recent_activity.scalars().all()
    
    # Get games played
    games_played = await db.execute(
        select(func.count(func.distinct(PlaySession.game_id)))
        .where(PlaySession.user_id == user_id)
    )
    unique_games = games_played.scalar() or 0
    
    user_data = user.to_dict(include_private=True)
    user_data["stats"] = {
        "total_sessions": total_sessions,
        "unique_games_played": unique_games,
        "recent_activity": [
            {
                "game_id": s.game_id,
                "duration": s.duration_seconds,
                "score": s.score,
                "played_at": s.played_at.isoformat() if s.played_at else None
            }
            for s in recent_sessions
        ]
    }
    
    return user_data


@api_router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    user_update: UserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update user information"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from demoting themselves
    if user.id == admin.id and user_update.is_admin is False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Check for username/email conflicts
    if user_update.username and user_update.username != user.username:
        existing = await db.execute(
            select(User).where(User.username == user_update.username)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
    
    if user_update.email and user_update.email != user.email:
        existing = await db.execute(
            select(User).where(User.email == user_update.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
    
    # Apply updates
    if update_data:
        await db.execute(
            update(User).where(User.id == user_id).values(**update_data)
        )
        await db.commit()
    
    # Fetch updated user
    result = await db.execute(select(User).where(User.id == user_id))
    updated_user = result.scalar_one()
    
    return {"success": True, "user": updated_user.to_dict(include_private=True)}


@api_router.post("/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    reason: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Ban a user"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban an admin user")
    
    await db.execute(
        update(User).where(User.id == user_id).values(
            is_banned=True,
            ban_reason=reason
        )
    )
    await db.commit()
    
    security_logger.info(f"ADMIN ACTION: User {user.id} ({user.username}) banned by admin {admin.id}. Reason: {reason}")
    
    return {"success": True, "message": f"User {user.username} has been banned"}


@api_router.post("/admin/users/{user_id}/unban")
async def admin_unban_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Unban a user"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.execute(
        update(User).where(User.id == user_id).values(
            is_banned=False,
            ban_reason=None
        )
    )
    await db.commit()
    
    security_logger.info(f"ADMIN ACTION: User {user.id} ({user.username}) unbanned by admin {admin.id}")
    
    return {"success": True, "message": f"User {user.username} has been unbanned"}


@api_router.post("/admin/users/{user_id}/make-admin")
async def admin_make_admin(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Make a user an admin"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_banned:
        raise HTTPException(status_code=400, detail="Cannot make a banned user an admin")
    
    await db.execute(
        update(User).where(User.id == user_id).values(is_admin=True)
    )
    await db.commit()
    
    return {"success": True, "message": f"User {user.username} is now an admin"}


@api_router.post("/admin/users/{user_id}/remove-admin")
async def admin_remove_admin(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Remove admin status from a user"""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.execute(
        update(User).where(User.id == user_id).values(is_admin=False)
    )
    await db.commit()
    
    return {"success": True, "message": f"Admin status removed from {user.username}"}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user and all their data"""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete an admin user")
    
    # Delete user (cascades to related records)
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    
    return {"success": True, "message": f"User {user.username} has been deleted"}


@api_router.get("/admin/users/stats/overview")
async def admin_users_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get user statistics overview"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Total users
    total = await db.execute(select(func.count(User.id)))
    total_users = total.scalar() or 0
    
    # Admins
    admins = await db.execute(select(func.count(User.id)).where(User.is_admin == True))
    admin_count = admins.scalar() or 0
    
    # Banned users
    banned = await db.execute(select(func.count(User.id)).where(User.is_banned == True))
    banned_count = banned.scalar() or 0
    
    # New users today
    new_today = await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    new_today_count = new_today.scalar() or 0
    
    # New users this week
    new_week = await db.execute(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    )
    new_week_count = new_week.scalar() or 0
    
    # New users this month
    new_month = await db.execute(
        select(func.count(User.id)).where(User.created_at >= month_ago)
    )
    new_month_count = new_month.scalar() or 0
    
    # Active users (played in last 24 hours)
    active = await db.execute(
        select(func.count(func.distinct(PlaySession.user_id))).where(
            PlaySession.played_at >= now - timedelta(hours=24)
        )
    )
    active_count = active.scalar() or 0
    
    return {
        "total_users": total_users,
        "admin_count": admin_count,
        "banned_count": banned_count,
        "new_today": new_today_count,
        "new_this_week": new_week_count,
        "new_this_month": new_month_count,
        "active_24h": active_count
    }


# ==================== APP SETUP ====================

# Include router
app.include_router(api_router)

# GZip compression for all responses (minimum 500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS middleware - configurable via environment variable
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
cors_origins = CORS_ORIGINS.split(',') if CORS_ORIGINS != '*' else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage buckets (sync function for startup)
def init_storage_buckets():
    """Create storage buckets if they don't exist"""
    if not supabase_client:
        logger.warning("Supabase client not initialized, skipping bucket creation")
        return
    
    try:
        # List existing buckets
        existing_buckets = supabase_client.storage.list_buckets()
        existing_names = [b.name for b in existing_buckets]
        logger.info(f"Existing storage buckets: {existing_names}")
        
        buckets_to_create = [GAMES_BUCKET, THUMBNAILS_BUCKET, PREVIEWS_BUCKET]
        
        for bucket_name in buckets_to_create:
            if bucket_name not in existing_names:
                try:
                    supabase_client.storage.create_bucket(id=bucket_name, options={"public": True})
                    logger.info(f"Created storage bucket: {bucket_name}")
                except Exception as e:
                    logger.warning(f"Bucket {bucket_name} creation: {e}")
            else:
                logger.info(f"Bucket {bucket_name} already exists")
    except Exception as e:
        logger.error(f"Error initializing storage buckets: {e}")

# Startup event
@app.on_event("startup")
async def startup():
    logger.info("Starting Hypd Games API with Supabase PostgreSQL")
    # Initialize storage buckets
    init_storage_buckets()

# Root redirect
@app.get("/")
async def root():
    return {"message": "Hypd Games API", "docs": "/docs", "database": "postgresql", "storage": "supabase"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
