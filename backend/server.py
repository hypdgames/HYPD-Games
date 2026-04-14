"""
Hypd Games API Server
Backend powered by FastAPI + Supabase PostgreSQL + Supabase Storage
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, Request, Response
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
    WalletTransaction, TransactionType, TransactionStatus, CoinPackage, PremiumGame, UserUnlockedGame,
    IdleGameState, GameComment, CommentLike
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
JWT_SECRET = os.environ.get('JWT_SECRET')
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

# ── Simple in-memory API cache — reduces Supabase round-trips significantly ───
_api_cache: dict = {}  # {key: {"data": Any, "ts": float}}
API_CACHE_MAX_ENTRIES = 32
PUBLIC_FEED_LIMIT = 300
PUBLIC_GAMES_LIMIT = 500
PUBLIC_GAMES_MAX_LIMIT = 1000


def _prune_api_cache(max_entries: int = API_CACHE_MAX_ENTRIES) -> None:
    """Keep the in-memory API cache bounded on small Railway instances."""
    if len(_api_cache) <= max_entries:
        return
    # Drop the oldest cache entries first.
    oldest_keys = sorted(_api_cache, key=lambda k: _api_cache[k]["ts"])[: len(_api_cache) - max_entries]
    for key in oldest_keys:
        _api_cache.pop(key, None)

def _cache_get(key: str, ttl: int = 30):
    """Return cached data if fresh, else None."""
    entry = _api_cache.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    return None

def _cache_set(key: str, data) -> None:
    _api_cache[key] = {"data": data, "ts": time.time()}
    _prune_api_cache()

def _invalidate_games_cache() -> None:
    """Bust games/categories caches. Call after any admin game mutation."""
    for k in list(_api_cache):
        if k.startswith("games:") or k == "categories":
            del _api_cache[k]

def _invalidate_video_batch_cache() -> None:
    """Clear the batch-level video URL cache so next request re-fetches fresh URLs."""
    _gmz_batch_cache.clear()

def _invalidate_all_game_caches() -> None:
    """Bust both the games list cache AND the video batch cache."""
    _invalidate_games_cache()
    _invalidate_video_batch_cache()


def _invalidate_settings_cache() -> None:
    """Bust cached settings after admin updates."""
    _api_cache.pop("settings", None)


def _public_user_summary(row) -> dict:
    """Serialize the lightweight user shape used by social surfaces."""
    return {
        "id": row.id,
        "username": row.username,
        "avatar_url": row.avatar_url,
        "total_games_played": row.total_games_played or 0,
        "total_play_time": row.total_play_time or 0,
    }


def _parse_id_list(raw_ids: Optional[str], max_ids: int) -> list[str]:
    """Parse a comma-separated list of ids into a bounded, de-duplicated list."""
    if not raw_ids:
        return []

    ids: list[str] = []
    seen: set[str] = set()
    for value in raw_ids.split(","):
        item = value.strip()
        if not item or item in seen:
            continue
        seen.add(item)
        ids.append(item)
        if len(ids) >= max_ids:
            break
    return ids

# Batch-level cache for video previews (avoids re-fetching on every cold start)
_gmz_batch_cache: dict = {}
GMZ_BATCH_CACHE_TTL = 900  # 15 minutes
GMZ_BATCH_DEFAULT_LIMIT = 120
GMZ_BATCH_MAX_LIMIT = 200
GMZ_BATCH_CONCURRENCY = 12
COMMENT_COUNTS_MAX_IDS = 300

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
    # Wallet fields
    coin_balance: int = 0
    total_coins_purchased: int = 0
    total_coins_spent: int = 0
    total_coins_earned: int = 0

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
    thumbnail_wide_url: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    video_preview_url: Optional[str] = None
    gif_preview_url: Optional[str] = None
    preview_type: str = "image"
    game_file_url: Optional[str] = None  # Supabase Storage URL or GD embed URL
    has_game_file: bool = False
    is_visible: bool = True
    show_in_feed: bool = True
    play_count: int = 0
    created_at: Optional[str] = None
    gd_game_id: Optional[str] = None
    source: str = "custom"
    embed_url: Optional[str] = None
    instructions: Optional[str] = None

class GameFeedResponse(BaseModel):
    """Lightweight response for feed/explore — omits heavy fields to cut payload ~60%."""
    id: str
    title: str
    description: Optional[str] = None
    category: str
    thumbnail_url: Optional[str] = None
    icon_url: Optional[str] = None
    play_count: int = 0
    like_count: int = 0
    created_at: Optional[str] = None

    def model_post_init(self, __context):
        if self.description and len(self.description) > 120:
            self.description = self.description[:117] + "..."

class PlaySessionCreate(BaseModel):
    game_id: str
    duration_seconds: int
    score: Optional[int] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "role": "authenticated",          # Supabase PostgREST role claim
        "iss": "hypd-games",              # Issuer — matches Supabase JWT secret alignment
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
        
        # Award bonus coins for streak milestones
        coins_earned = 0
        if user.login_streak == 7:
            coins_earned = 50  # 7-day milestone
        elif user.login_streak == 14:
            coins_earned = 100  # 14-day milestone
        elif user.login_streak == 30:
            coins_earned = 250  # 30-day milestone
        elif user.login_streak == 60:
            coins_earned = 500  # 60-day milestone
        elif user.login_streak == 90:
            coins_earned = 750  # 90-day milestone
        elif user.login_streak == 180:
            coins_earned = 1500  # 180-day milestone
        elif user.login_streak == 365:
            coins_earned = 5000  # 365-day milestone
        elif user.login_streak % 30 == 0 and user.login_streak > 90:
            coins_earned = 300  # Every 30 days after 90 days
        
        if coins_earned > 0:
            user.coin_balance = (user.coin_balance or 0) + coins_earned
            user.total_coins_earned = (user.total_coins_earned or 0) + coins_earned
        
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
        coins_earned = 0
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
                coin_balance=user.coin_balance,
                total_coins_earned=user.total_coins_earned,
                last_active_at=datetime.now(timezone.utc)
            )
        )
        await db.commit()
        await db.refresh(user)
        
        if streak_updated:
            logger.info(f"Login streak updated for user {user.id}: streak={user.login_streak}, points={points_earned}, coins={coins_earned}")
    
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
        await db.execute(update(Game).where(Game.id == game_id).values(like_count=Game.like_count + 1))
        await db.commit()
        _invalidate_games_cache()
    return {"saved_games": saved}

@api_router.delete("/auth/save-game/{game_id}")
async def unsave_game(game_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    saved = user.saved_games or []
    if game_id in saved:
        saved.remove(game_id)
        await db.execute(update(User).where(User.id == user.id).values(saved_games=saved))
        await db.execute(update(Game).where(Game.id == game_id).values(like_count=func.greatest(0, Game.like_count - 1)))
        await db.commit()
        _invalidate_games_cache()
    return {"saved_games": saved}

# ==================== GAMES ENDPOINTS ====================

import hashlib as _hashlib

def _seeded_random(seed: str, game_id: str) -> float:
    """Deterministic 0-1 float from seed + game_id. Different seed → different order."""
    digest = _hashlib.md5(f"{seed}:{game_id}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _category_boosts(saved_categories: list) -> dict:
    """Return category → boost (0.0–0.45) based on user's save history frequency."""
    if not saved_categories:
        return {}
    from collections import Counter
    counts = Counter(saved_categories)
    max_count = max(counts.values())
    return {cat: round(cnt / max_count * 0.45, 3) for cat, cnt in counts.items()}

@api_router.get("/games")
async def get_games(
    category: Optional[str] = None,
    visible_only: bool = True,
    feed_only: bool = True,
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get games for the feed/explore. Results cached in memory for 5 minutes to avoid DB round-trips."""
    effective_limit = limit if limit is not None else (PUBLIC_FEED_LIMIT if feed_only else PUBLIC_GAMES_LIMIT)
    effective_limit = max(1, min(effective_limit, PUBLIC_GAMES_MAX_LIMIT))
    cache_key = f"games:feed={feed_only}:cat={category}:limit={effective_limit}"
    cached = _cache_get(cache_key, ttl=300)  # 5 min TTL — long enough to avoid frequent DB hits
    if cached is not None:
        response = JSONResponse(content=cached)
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        return response

    query = select(Game)
    if category and category != "all":
        query = query.where(Game.category == category)
    if visible_only:
        query = query.where(Game.is_visible.is_(True))
    if feed_only:
        query = query.where(Game.show_in_feed.is_not(False))

    query = query.order_by(Game.created_at.desc()).limit(effective_limit)
    result = await db.execute(query)
    games = result.scalars().all()

    game_responses = [GameFeedResponse(**g.to_dict()).model_dump() for g in games]
    _cache_set(cache_key, game_responses)

    response = JSONResponse(content=game_responses)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response


@api_router.get("/games/video-previews-batch")
async def get_video_previews_batch(
    ids: Optional[str] = None,
    limit: int = GMZ_BATCH_DEFAULT_LIMIT,
    db: AsyncSession = Depends(get_db),
):
    """Fetch recent GMZ video preview URLs used by the feed.
    The batch is bounded and cached briefly to avoid cold-start fan-out on Railway."""
    import asyncio

    requested_ids = _parse_id_list(ids, GMZ_BATCH_MAX_LIMIT)
    limit = max(1, min(limit, GMZ_BATCH_MAX_LIMIT))
    if requested_ids:
        limit = min(limit, len(requested_ids))
    id_key = ",".join(sorted(requested_ids)) if requested_ids else "all"
    cache_key = f"ids:{id_key}:limit:{limit}"
    now = time.time()
    cached_batch = _gmz_batch_cache.get(cache_key)
    if cached_batch and (now - cached_batch["ts"]) < GMZ_BATCH_CACHE_TTL:
        response = JSONResponse(content=cached_batch["data"])
        response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=3600"
        return response

    query = select(Game).where(
        Game.source == "gamemonetize",
        Game.is_visible.is_(True),
        Game.show_in_feed.is_not(False),
        Game.embed_url.is_not(None),
    )
    if requested_ids:
        query = query.where(Game.id.in_(requested_ids))

    result = await db.execute(query.order_by(Game.created_at.desc()).limit(limit))
    games = result.scalars().all()
    semaphore = asyncio.Semaphore(GMZ_BATCH_CONCURRENCY)

    async def fetch_for_game(game):
        async with semaphore:
            parts = (game.embed_url or "").rstrip("/").split("/")
            game_hash = parts[-1] if parts else None
            if not game_hash or len(game_hash) < 10:
                return game.id, None
            url = await _fetch_gmz_video_url(game_hash, game.title)
            return game.id, url

    results = await asyncio.gather(*[fetch_for_game(g) for g in games], return_exceptions=True)
    batch = {
        gid: url
        for item in results
        if not isinstance(item, Exception)
        for gid, url in [item]
        if url
    }

    _gmz_batch_cache[cache_key] = {"data": batch, "ts": now}

    response = JSONResponse(content=batch)
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=3600"
    return response


@api_router.get("/games/comment-counts")
async def get_comment_counts(
    response: Response,
    ids: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Batch comment counts for games currently shown in the UI. Cached 5 min."""
    requested_ids = _parse_id_list(ids, COMMENT_COUNTS_MAX_IDS)
    cache_key = f"comment_counts:{','.join(sorted(requested_ids)) if requested_ids else 'all'}"
    cached = _cache_get(cache_key, ttl=300)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        return cached

    query = select(GameComment.game_id, func.count(GameComment.id).label("count")).group_by(GameComment.game_id)
    if requested_ids:
        query = query.where(GameComment.game_id.in_(requested_ids))

    result = await db.execute(query)
    counts = {row[0]: row[1] for row in result.all()}
    _cache_set(cache_key, counts)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return counts


@api_router.get("/games/feed")
async def get_personalized_feed(
    seed: str = "",
    limit: int = PUBLIC_FEED_LIMIT,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Personalised, randomised game feed.

    - `seed`: a random string generated by the client each page-load. The same
      seed produces the same ordering within a session; a new seed (new visit)
      produces a completely different ordering.
    - If the authenticated user has saved games, games from their most-saved
      categories receive a boost so they surface higher on average.
    - Guests receive a pure seeded-random shuffle with no category bias.
    """
    # 1. Base game list (re-use backend in-memory cache populated by /games)
    limit = max(1, min(limit, PUBLIC_GAMES_MAX_LIMIT))
    cache_key = f"games:feed=True:cat=None:limit={limit}"
    games_data = _cache_get(cache_key, ttl=300)
    if games_data is None:
        result = await db.execute(
            select(Game)
            .where(Game.is_visible.is_(True), Game.show_in_feed.is_not(False))
            .order_by(Game.created_at.desc())
            .limit(limit)
        )
        games_data = [GameFeedResponse(**g.to_dict()).model_dump() for g in result.scalars().all()]
        _cache_set(cache_key, games_data)

    # 2. Category preference boosts from the user's saved-game history
    boosts: dict = {}
    if user and user.saved_games:
        cat_result = await db.execute(
            select(Game.category).where(
                Game.id.in_(user.saved_games),
                Game.category.is_not(None),
            )
        )
        boosts = _category_boosts([row[0] for row in cat_result.all()])

    # 3. Score every game and return highest-scoring first
    effective_seed = seed or "default"

    def _score(game: dict) -> float:
        # Random component (0–1) unique per seed + game — changes every visit
        rand = _seeded_random(effective_seed, game["id"])
        # Category boost (0–0.45) pulls preferred-category games toward the top
        boost = boosts.get(game.get("category") or "", 0.0)
        return rand + boost

    return sorted(games_data, key=_score, reverse=True)


@api_router.get("/auth/saved-games")
async def get_saved_games(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return only the authenticated user's saved games to avoid downloading the full catalog."""
    saved_ids = user.saved_games or []
    if not saved_ids:
        return []

    result = await db.execute(
        select(Game)
        .where(Game.id.in_(saved_ids), Game.is_visible.is_(True))
        .order_by(Game.created_at.desc())
    )
    games = {game.id: GameFeedResponse(**game.to_dict()).model_dump() for game in result.scalars().all()}
    return [games[game_id] for game_id in saved_ids if game_id in games]


@api_router.get("/games/recently-played")
async def get_recently_played(
    limit: int = 5,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the last N unique games the authenticated user has played, most recent first."""
    subq = (
        select(PlaySession.game_id, func.max(PlaySession.played_at).label("last_played"))
        .where(PlaySession.user_id == user.id)
        .group_by(PlaySession.game_id)
        .subquery()
    )
    result = await db.execute(
        select(Game, subq.c.last_played)
        .join(subq, Game.id == subq.c.game_id)
        .where(Game.is_visible.is_(True))
        .order_by(desc(subq.c.last_played))
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": g.id,
            "title": g.title,
            "thumbnail_url": g.thumbnail_url,
            "icon_url": g.icon_url,
            "category": g.category,
        }
        for g, _ in rows
    ]


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


# In-memory cache for GMZ video preview URLs {hash: {url, fetched_at}}
_gmz_video_cache: dict = {}
GMZ_VIDEO_CACHE_TTL = 3600  # 1 hour
GMZ_VIDEO_CACHE_MAX_ITEMS = 300


def _prune_gmz_video_cache() -> None:
    """Bound the preview-URL cache so it doesn't grow with the whole catalog."""
    if len(_gmz_video_cache) <= GMZ_VIDEO_CACHE_MAX_ITEMS:
        return
    oldest_keys = sorted(
        _gmz_video_cache,
        key=lambda key: _gmz_video_cache[key]["fetched_at"],
    )[: len(_gmz_video_cache) - GMZ_VIDEO_CACHE_MAX_ITEMS]
    for key in oldest_keys:
        _gmz_video_cache.pop(key, None)

async def _fetch_gmz_video_url(game_hash: str, game_title: str) -> Optional[str]:
    """Fetch direct MP4 URL for a GMZ game. Returns None on failure."""
    import time, httpx
    cached = _gmz_video_cache.get(game_hash)
    if cached and (time.time() - cached["fetched_at"]) < GMZ_VIDEO_CACHE_TTL:
        return cached["url"]
    try:
        gmz_api_url = f"https://gamemonetize.video/video.php?page_url=&gameid={game_hash}&game={game_title}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(gmz_api_url, headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
                "Referer": "https://gamemonetize.video/",
            })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("isSuccess") and data.get("data", {}).get("detail"):
                video_url = data["data"]["detail"][0].get("mediaURL")
                _gmz_video_cache[game_hash] = {"url": video_url, "fetched_at": time.time()}
                _prune_gmz_video_cache()
                return video_url
    except Exception:
        pass
    return None


@api_router.get("/games/{game_id}/video-preview")
async def get_game_video_preview(game_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch the direct MP4 video URL for a single GMZ game walkthrough."""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.source != "gamemonetize" or not game.embed_url:
        return JSONResponse(content={"video_url": None})

    parts = game.embed_url.rstrip("/").split("/")
    game_hash = parts[-1] if parts else None
    if not game_hash or len(game_hash) < 10:
        return JSONResponse(content={"video_url": None})

    video_url = await _fetch_gmz_video_url(game_hash, game.title)
    return JSONResponse(content={"video_url": video_url})

@api_router.get("/games/{game_id}/play")
async def get_game_file(
    game_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Serve game HTML content directly (avoids CSP issues from Supabase Storage redirect)"""

    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Increment play count (fire and forget - don't block response)
    await db.execute(update(Game).where(Game.id == game_id).values(play_count=Game.play_count + 1))
    await db.commit()

    
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
    
    # Handle GameMonetize games - return embed wrapper
    if game.source == "gamemonetize" and game.embed_url:
        gmz_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>{game.title}</title>
            <link rel="preconnect" href="https://html5.gamemonetize.com">
            <link rel="dns-prefetch" href="https://html5.gamemonetize.com">
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
        response = HTMLResponse(content=gmz_html, media_type="text/html")
        response.headers["Cache-Control"] = "public, max-age=3600"  # Cache for 1 hour
        return response
    
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
    """Get all unique game categories — cached for 5 minutes."""
    cached = _cache_get("categories", ttl=300)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Game.category)
        .where(Game.is_visible.is_(True))
        .distinct()
    )
    categories = [row[0] for row in result.all()]
    data = {"categories": categories}
    _cache_set("categories", data)
    return data


@api_router.get("/categories/details")
async def get_category_details(db: AsyncSession = Depends(get_db)):
    """Get category summaries plus preview games for Explore."""
    cache_key = "categories:details"
    cached = _cache_get(cache_key, ttl=300)
    if cached is not None:
        response = JSONResponse(content=cached)
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        return response

    result = await db.execute(
        select(
            Game.id,
            Game.title,
            Game.description,
            Game.category,
            Game.thumbnail_url,
            Game.icon_url,
            Game.play_count,
            Game.created_at,
        )
        .where(Game.is_visible.is_(True))
        .order_by(Game.created_at.desc())
    )
    rows = result.all()

    categories: dict[str, dict] = {}
    for row in rows:
        category_name = (row.category or "").strip()
        if not category_name:
            continue

        entry = categories.setdefault(
            category_name,
            {
                "name": category_name,
                "game_count": 0,
                "preview_img": None,
                "first_game_id": None,
                "top_play_count": -1,
                "games": [],
            },
        )

        entry["game_count"] += 1
        if not entry["preview_img"]:
            entry["preview_img"] = row.thumbnail_url or row.icon_url

        play_count = row.play_count or 0
        if play_count > entry["top_play_count"]:
            entry["top_play_count"] = play_count
            entry["first_game_id"] = row.id

        if len(entry["games"]) < 8:
            entry["games"].append(
                {
                    "id": row.id,
                    "title": row.title,
                    "description": row.description,
                    "category": category_name,
                    "thumbnail_url": row.thumbnail_url,
                    "icon_url": row.icon_url,
                    "play_count": play_count,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )

    data = {
        "categories": sorted(
            [
                {
                    "name": entry["name"],
                    "game_count": entry["game_count"],
                    "preview_img": entry["preview_img"],
                    "first_game_id": entry["first_game_id"],
                    "games": entry["games"],
                }
                for entry in categories.values()
            ],
            key=lambda item: (-item["game_count"], item["name"].lower()),
        )
    }
    _cache_set(cache_key, data)

    response = JSONResponse(content=data)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response

# ==================== COMMENTS ENDPOINTS ====================

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

@api_router.get("/games/{game_id}/comments")
async def get_game_comments(
    game_id: str,
    limit: int = 50,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comments for a game with like counts and current user's like status."""
    result = await db.execute(
        select(GameComment, User.username, User.avatar_url)
        .join(User, GameComment.user_id == User.id)
        .where(GameComment.game_id == game_id)
        .order_by(GameComment.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    if not rows:
        return {"comments": [], "count": 0}

    comment_ids = [row[0].id for row in rows]

    # Batch fetch like counts
    like_count_result = await db.execute(
        select(CommentLike.comment_id, func.count(CommentLike.id).label("cnt"))
        .where(CommentLike.comment_id.in_(comment_ids))
        .group_by(CommentLike.comment_id)
    )
    like_counts = {row[0]: row[1] for row in like_count_result.all()}

    # Fetch which comments the current user has liked
    user_liked_ids: set = set()
    if user:
        liked_result = await db.execute(
            select(CommentLike.comment_id)
            .where(CommentLike.comment_id.in_(comment_ids), CommentLike.user_id == user.id)
        )
        user_liked_ids = {row[0] for row in liked_result.all()}

    comments = []
    for comment, username, avatar_url in rows:
        data = comment.to_dict()
        data["username"] = username
        data["avatar_url"] = avatar_url
        data["like_count"] = like_counts.get(comment.id, 0)
        data["liked_by_me"] = comment.id in user_liked_ids
        comments.append(data)

    return {"comments": comments, "count": len(comments)}

@api_router.post("/games/{game_id}/comments")
async def post_game_comment(
    game_id: str,
    comment_data: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Post a comment on a game (requires auth)."""
    game_result = await db.execute(select(Game).where(Game.id == game_id))
    if not game_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Game not found")

    comment = GameComment(
        id=str(uuid.uuid4()),
        game_id=game_id,
        user_id=user.id,
        content=comment_data.content.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    data = comment.to_dict()
    data["username"] = user.username
    data["avatar_url"] = user.avatar_url
    return data

@api_router.delete("/games/{game_id}/comments/{comment_id}")
async def delete_game_comment(
    game_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete own comment or any comment if admin."""
    result = await db.execute(
        select(GameComment).where(GameComment.id == comment_id, GameComment.game_id == game_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.execute(delete(GameComment).where(GameComment.id == comment_id))
    await db.commit()
    return {"success": True}


@api_router.post("/games/{game_id}/comments/{comment_id}/like")
async def like_comment(
    game_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Like a comment. Idempotent — calling again returns liked=True without error."""
    result = await db.execute(
        select(GameComment).where(GameComment.id == comment_id, GameComment.game_id == game_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.execute(
        select(CommentLike).where(CommentLike.comment_id == comment_id, CommentLike.user_id == user.id)
    )
    if not existing.scalar_one_or_none():
        db.add(CommentLike(id=str(uuid.uuid4()), comment_id=comment_id, user_id=user.id))
        await db.commit()
    return {"liked": True}


@api_router.delete("/games/{game_id}/comments/{comment_id}/like")
async def unlike_comment(
    game_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unlike a comment."""
    await db.execute(
        delete(CommentLike).where(CommentLike.comment_id == comment_id, CommentLike.user_id == user.id)
    )
    await db.commit()
    return {"liked": False}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/games")
async def admin_get_games(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    page: Optional[int] = None,
    limit: Optional[int] = None,
):
    """Get admin games, with optional pagination for dashboard stability."""
    base_query = select(Game).order_by(Game.created_at.desc())

    if page is None and limit is None:
        result = await db.execute(base_query)
        games = result.scalars().all()
        return [GameResponse(**g.to_dict()) for g in games]

    safe_page = max(page or 1, 1)
    safe_limit = min(max(limit or 100, 1), 200)
    total = await db.scalar(select(func.count()).select_from(Game)) or 0

    result = await db.execute(
        base_query.offset((safe_page - 1) * safe_limit).limit(safe_limit)
    )
    games = result.scalars().all()

    return {
        "games": [GameResponse(**g.to_dict()) for g in games],
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
        "has_more": safe_page * safe_limit < total,
    }

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
        _invalidate_games_cache()
        
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
    _invalidate_games_cache()
    
    return {"success": True, "is_visible": visibility.get("is_visible", True)}


@api_router.patch("/admin/games/{game_id}/feed-visibility")
async def admin_toggle_feed_visibility(
    game_id: str,
    data: dict,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Toggle whether a game appears in the main feed (vs explore only)"""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    show_in_feed = data.get("show_in_feed", True)
    await db.execute(
        update(Game)
        .where(Game.id == game_id)
        .values(show_in_feed=show_in_feed)
    )
    await db.commit()
    _invalidate_games_cache()
    return {"success": True, "show_in_feed": show_in_feed}

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
    _invalidate_games_cache()
    
    return {"success": True, "deleted_id": game_id}

class BulkDeleteRequest(BaseModel):
    game_ids: List[str]

@api_router.post("/admin/games/bulk-delete")
async def admin_bulk_delete_games(
    request: BulkDeleteRequest,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk delete multiple games"""
    if not request.game_ids:
        raise HTTPException(status_code=400, detail="No game IDs provided")
    
    # Get games to delete
    result = await db.execute(select(Game).where(Game.id.in_(request.game_ids)))
    games_to_delete = result.scalars().all()
    
    deleted_ids = []
    deleted_titles = []
    
    for game in games_to_delete:
        # Remove from cache
        if game.id in game_files_cache:
            del game_files_cache[game.id]
        deleted_ids.append(game.id)
        deleted_titles.append(game.title)
    
    # Delete from database
    if deleted_ids:
        await db.execute(delete(Game).where(Game.id.in_(deleted_ids)))
        await db.commit()
    
    _invalidate_games_cache()
    logger.info(f"Bulk deleted {len(deleted_ids)} games")
    
    return {
        "success": True,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "deleted_titles": deleted_titles,
        "not_found_count": len(request.game_ids) - len(deleted_ids)
    }

@api_router.delete("/admin/games/cleanup/by-source")
async def admin_cleanup_games_by_source(
    source: str,
    dry_run: bool = False,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete all games from a specific source (custom, gamemonetize). Use dry_run=true to preview without deleting."""
    valid_sources = ["custom", "gamemonetize"]
    if source not in valid_sources:
        raise HTTPException(status_code=400, detail=f"Invalid source. Must be one of: {valid_sources}")
    
    # Get games to delete
    if source == "custom":
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

    if dry_run:
        return {
            "dry_run": True,
            "source": source,
            "would_delete_count": len(deleted_ids),
            "would_delete_games": deleted_titles
        }
    
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
    _invalidate_games_cache()
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
    _invalidate_games_cache()
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
async def get_settings(response: Response, db: AsyncSession = Depends(get_db)):
    """Get app settings"""
    cached = _cache_get("settings", ttl=300)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        return cached

    result = await db.execute(select(AppSettings))
    settings = result.scalars().all()
    payload = {s.key: s.value for s in settings}
    _cache_set("settings", payload)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return payload

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
    _invalidate_settings_cache()
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

# ==================== WALLET / COINS SYSTEM ====================

# Stripe is optional - purchases disabled if not configured
STRIPE_ENABLED = False
try:
    import stripe
    # Only enable if we have a real API key (not the placeholder)
    if STRIPE_API_KEY and not STRIPE_API_KEY.startswith("sk_test_emergent"):
        stripe.api_key = STRIPE_API_KEY
        STRIPE_ENABLED = True
        logger.info("Stripe payments enabled")
    else:
        logger.info("Stripe API key not configured - purchases disabled")
except ImportError:
    logger.info("Stripe SDK not installed - purchases disabled")

# Coin package definitions (backend-controlled for security)
COIN_PACKAGES = {
    "starter": {"name": "Starter Pack", "coins": 100, "price": 0.99, "bonus": 0},
    "popular": {"name": "Popular Pack", "coins": 550, "price": 4.99, "bonus": 50},
    "value": {"name": "Value Pack", "coins": 1200, "price": 9.99, "bonus": 200},
    "mega": {"name": "Mega Pack", "coins": 2700, "price": 19.99, "bonus": 700},
    "ultimate": {"name": "Ultimate Pack", "coins": 7000, "price": 49.99, "bonus": 2000},
}

class WalletPurchaseRequest(BaseModel):
    package_id: str
    origin_url: str  # Frontend origin for success/cancel URLs

class WalletSpendRequest(BaseModel):
    spend_type: str  # 'premium_game'
    game_id: Optional[str] = None  # For premium_game unlock

@api_router.get("/wallet")
async def get_wallet(user: User = Depends(get_current_user)):
    """Get user's wallet information"""
    return {
        "coin_balance": user.coin_balance or 0,
        "total_coins_purchased": user.total_coins_purchased or 0,
        "total_coins_spent": user.total_coins_spent or 0,
        "total_coins_earned": user.total_coins_earned or 0
    }

@api_router.get("/wallet/packages")
async def get_coin_packages():
    """Get available coin packages for purchase"""
    packages = []
    for pkg_id, pkg in COIN_PACKAGES.items():
        packages.append({
            "package_id": pkg_id,
            "name": pkg["name"],
            "coins": pkg["coins"],
            "bonus_coins": pkg["bonus"],
            "total_coins": pkg["coins"] + pkg["bonus"],
            "price_usd": pkg["price"],
            "is_popular": pkg_id == "popular"
        })
    return {
        "packages": sorted(packages, key=lambda x: x["price_usd"]),
        "purchases_enabled": STRIPE_ENABLED
    }

@api_router.post("/wallet/purchase")
async def create_purchase_checkout(
    request: Request,
    purchase: WalletPurchaseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create Stripe checkout session for coin purchase"""
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Coin purchases are coming soon! Stay tuned.")
    
    # Validate package
    if purchase.package_id not in COIN_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    package = COIN_PACKAGES[purchase.package_id]
    
    # Build URLs from frontend origin (not hardcoded)
    success_url = f"{purchase.origin_url}/wallet?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{purchase.origin_url}/wallet?payment=cancelled"
    
    try:
        # Create Stripe checkout session using standard SDK
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": package["name"],
                        "description": f"{package['coins']} coins" + (f" + {package['bonus']} bonus" if package["bonus"] > 0 else ""),
                    },
                    "unit_amount": int(package["price"] * 100),  # Stripe uses cents
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user.id,
                "package_id": purchase.package_id,
                "coins": str(package["coins"]),
                "bonus_coins": str(package["bonus"]),
                "type": "coin_purchase"
            }
        )
        
        # Create pending transaction record
        transaction = WalletTransaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            transaction_type=TransactionType.PURCHASE,
            status=TransactionStatus.PENDING,
            coins=package["coins"] + package["bonus"],
            amount_usd=package["price"],
            stripe_session_id=session.id,
            package_id=purchase.package_id,
            description=f"Purchase: {package['name']}",
            extra_data={
                "package_name": package["name"],
                "base_coins": package["coins"],
                "bonus_coins": package["bonus"]
            }
        )
        db.add(transaction)
        await db.commit()
        
        logger.info(f"Created checkout session for user {user.id}, package: {purchase.package_id}")
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
        
    except stripe.error.AuthenticationError as e:
        logger.error(f"Stripe authentication error: {e}")
        raise HTTPException(status_code=500, detail="Payment system configuration error. Please contact support.")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error. Please try again.")
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/wallet/checkout/status/{session_id}")
async def check_payment_status(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check payment status and credit coins if successful"""
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Payment system not available")
    
    # Find the transaction
    result = await db.execute(
        select(WalletTransaction).where(WalletTransaction.stripe_session_id == session_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify it belongs to this user
    if transaction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # If already completed, return status
    if transaction.status == TransactionStatus.COMPLETED:
        return {
            "status": "completed",
            "payment_status": "paid",
            "coins_credited": transaction.coins,
            "new_balance": user.coin_balance
        }
    
    # Check with Stripe using standard SDK
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid" and transaction.status == TransactionStatus.PENDING:
            # Credit coins to user (only once)
            await db.execute(
                update(User)
                .where(User.id == user.id)
                .values(
                    coin_balance=User.coin_balance + transaction.coins,
                    total_coins_purchased=User.total_coins_purchased + transaction.coins
                )
            )
            
            # Update transaction
            transaction.status = TransactionStatus.COMPLETED
            transaction.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            await db.refresh(user)
            
            logger.info(f"Credited {transaction.coins} coins to user {user.id}")
            
            return {
                "status": "completed",
                "payment_status": "paid",
                "coins_credited": transaction.coins,
                "new_balance": user.coin_balance
            }
        
        elif session.status == "expired":
            transaction.status = TransactionStatus.FAILED
            await db.commit()
            
            return {
                "status": "expired",
                "payment_status": "failed",
                "coins_credited": 0
            }
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "coins_credited": 0
        }
        
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events"""
    if not STRIPE_ENABLED:
        return {"status": "disabled"}
    
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    try:
        # Verify webhook signature if secret is configured
        if endpoint_secret and sig_header:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        else:
            # For testing without webhook secret
            import json
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        
        # Handle checkout.session.completed event
        if event.type == "checkout.session.completed":
            session = event.data.object
            
            if session.payment_status == "paid":
                # Find and update transaction
                result = await db.execute(
                    select(WalletTransaction).where(
                        WalletTransaction.stripe_session_id == session.id
                    )
                )
                transaction = result.scalar_one_or_none()
                
                if transaction and transaction.status == TransactionStatus.PENDING:
                    # Credit coins
                    await db.execute(
                        update(User)
                        .where(User.id == transaction.user_id)
                        .values(
                            coin_balance=User.coin_balance + transaction.coins,
                            total_coins_purchased=User.total_coins_purchased + transaction.coins
                        )
                    )
                    
                    transaction.status = TransactionStatus.COMPLETED
                    transaction.completed_at = datetime.now(timezone.utc)
                    transaction.stripe_payment_id = session.payment_intent
                    
                    await db.commit()
                    logger.info(f"Webhook: Credited {transaction.coins} coins to user {transaction.user_id}")
        
        return {"status": "ok"}
        
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.post("/wallet/spend")
async def spend_coins(
    spend_request: WalletSpendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Spend coins on features (premium games)"""
    
    if spend_request.spend_type == "premium_game":
        # Unlock premium game
        if not spend_request.game_id:
            raise HTTPException(status_code=400, detail="Game ID required")
        
        # Check if game is premium
        result = await db.execute(
            select(PremiumGame).where(
                PremiumGame.game_id == spend_request.game_id,
                PremiumGame.is_active == True
            )
        )
        premium_game = result.scalar_one_or_none()
        
        if not premium_game:
            raise HTTPException(status_code=404, detail="Game is not a premium game or not found")
        
        # Check if already unlocked
        result = await db.execute(
            select(UserUnlockedGame).where(
                UserUnlockedGame.user_id == user.id,
                UserUnlockedGame.game_id == spend_request.game_id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Game already unlocked")
        
        coins_needed = premium_game.coin_price
        
        if (user.coin_balance or 0) < coins_needed:
            raise HTTPException(status_code=400, detail=f"Insufficient coins. Need {coins_needed}, have {user.coin_balance or 0}")
        
        # Get game info for description
        game_result = await db.execute(select(Game).where(Game.id == spend_request.game_id))
        game = game_result.scalar_one_or_none()
        game_title = game.title if game else "Unknown Game"
        
        # Create transaction
        transaction = WalletTransaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            transaction_type=TransactionType.SPEND,
            status=TransactionStatus.COMPLETED,
            coins=-coins_needed,
            spend_type="premium_game",
            spend_reference=spend_request.game_id,
            description=f"Unlocked: {game_title}",
            completed_at=datetime.now(timezone.utc)
        )
        db.add(transaction)
        
        # Create unlock record
        unlock = UserUnlockedGame(
            id=str(uuid.uuid4()),
            user_id=user.id,
            game_id=spend_request.game_id
        )
        db.add(unlock)
        
        # Update user balance
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                coin_balance=User.coin_balance - coins_needed,
                total_coins_spent=User.total_coins_spent + coins_needed
            )
        )
        
        await db.commit()
        
        logger.info(f"User {user.id} unlocked premium game {spend_request.game_id} for {coins_needed} coins")
        
        return {
            "success": True,
            "coins_spent": coins_needed,
            "new_balance": (user.coin_balance or 0) - coins_needed,
            "game_id": spend_request.game_id,
            "message": f"Unlocked {game_title}!"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid spend type")

@api_router.get("/wallet/transactions")
async def get_transactions(
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's transaction history"""
    result = await db.execute(
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(desc(WalletTransaction.created_at))
        .offset(offset)
        .limit(limit)
    )
    transactions = result.scalars().all()
    
    return {
        "transactions": [t.to_dict() for t in transactions],
        "offset": offset,
        "limit": limit
    }

@api_router.get("/wallet/unlocked-games")
async def get_unlocked_games(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of premium games user has unlocked"""
    result = await db.execute(
        select(UserUnlockedGame).where(UserUnlockedGame.user_id == user.id)
    )
    unlocked = result.scalars().all()
    
    return {
        "unlocked_game_ids": [u.game_id for u in unlocked]
    }

# ==================== GAMEMONETIZE INTEGRATION ====================

# ==================== GAMEMONETIZE INTEGRATION ====================

# GameMonetize Configuration - Using custom feed URL
GAMEMONETIZE_FEED_URL = "https://gamemonetize.com/feed.php"

# In-memory cache for the full GameMonetize feed (avoids re-fetching on every browse request)
_gmz_cache: dict = {"games": [], "fetched_at": 0, "ttl": 1800}  # 30-min TTL

async def _fetch_full_gmz_feed() -> list:
    """Fetch the full GameMonetize feed, using cache when fresh."""
    now = time.time()
    if _gmz_cache["games"] and (now - _gmz_cache["fetched_at"]) < _gmz_cache["ttl"]:
        return _gmz_cache["games"]

    all_games: list = []
    rate_limited = False
    async with httpx.AsyncClient(timeout=60.0) as client:
        for feed_page in range(1, 20):  # safety cap at 20 pages (40k games)
            params = {"format": "0", "page": str(feed_page)}
            try:
                response = await client.get(GAMEMONETIZE_FEED_URL, params=params)
            except Exception as e:
                logger.warning(f"GameMonetize feed page {feed_page} request failed: {e}")
                break
            if response.status_code == 429:
                logger.warning(f"GameMonetize feed rate-limited (429) on page {feed_page}")
                rate_limited = True
                break
            if response.status_code != 200:
                logger.warning(f"GameMonetize feed page {feed_page} returned {response.status_code}")
                break
            page_games = response.json()
            if not isinstance(page_games, list) or len(page_games) == 0:
                break
            all_games.extend(page_games)
            if len(page_games) < 2000:
                break

    if all_games:
        # Success: update cache with fresh data
        logger.info(f"GameMonetize feed fetched: {len(all_games)} total games")
        _gmz_cache["games"] = all_games
        _gmz_cache["fetched_at"] = now
    elif rate_limited and _gmz_cache["games"]:
        # Rate-limited but stale cache exists — keep serving it, retry in 2 min
        logger.warning(f"GameMonetize rate-limited; serving {len(_gmz_cache['games'])} stale cached games, retry in 2 min")
        _gmz_cache["fetched_at"] = now - _gmz_cache["ttl"] + 120
    else:
        # Truly empty (rate-limited with no cache) — schedule a quick retry in 90 s
        logger.warning("GameMonetize feed returned no games; will retry in 90 s")
        _gmz_cache["fetched_at"] = now - _gmz_cache["ttl"] + 90

    return _gmz_cache["games"]

# GameMonetize categories (will be populated from feed)
GAMEMONETIZE_CATEGORIES = [
    {"id": "All", "name": "All Games", "icon": "🎮"},
    {"id": "Action", "name": "Action", "icon": "⚔️"},
    {"id": "Adventure", "name": "Adventure", "icon": "🗺️"},
    {"id": "Arcade", "name": "Arcade", "icon": "👾"},
    {"id": "Basketball", "name": "Basketball", "icon": "🏀"},
    {"id": "Beauty", "name": "Beauty", "icon": "💄"},
    {"id": "Bike", "name": "Bike", "icon": "🚴"},
    {"id": "Boys", "name": "Boys", "icon": "👦"},
    {"id": "Car", "name": "Car", "icon": "🚗"},
    {"id": "Card", "name": "Card", "icon": "🃏"},
    {"id": "Casual", "name": "Casual", "icon": "🎯"},
    {"id": "Clicker", "name": "Clicker", "icon": "👆"},
    {"id": "Cooking", "name": "Cooking", "icon": "🍳"},
    {"id": "Dressup", "name": "Dress Up", "icon": "👗"},
    {"id": "Driving", "name": "Driving", "icon": "🏎️"},
    {"id": "Escape", "name": "Escape", "icon": "🚪"},
    {"id": "FPS", "name": "FPS", "icon": "🔫"},
    {"id": "Girls", "name": "Girls", "icon": "👧"},
    {"id": "Horror", "name": "Horror", "icon": "👻"},
    {"id": "Hypercasual", "name": "Hypercasual", "icon": "⚡"},
    {"id": "io", "name": ".io Games", "icon": "🌐"},
    {"id": "Mahjong", "name": "Mahjong", "icon": "🀄"},
    {"id": "Minecraft", "name": "Minecraft", "icon": "⛏️"},
    {"id": "Multiplayer", "name": "Multiplayer", "icon": "👥"},
    {"id": "Puzzle", "name": "Puzzle", "icon": "🧩"},
    {"id": "Racing", "name": "Racing", "icon": "🏁"},
    {"id": "Shooting", "name": "Shooting", "icon": "🎯"},
    {"id": "Soccer", "name": "Soccer", "icon": "⚽"},
    {"id": "Sports", "name": "Sports", "icon": "🏆"},
    {"id": "Stickman", "name": "Stickman", "icon": "🏃"},
    {"id": "Strategy", "name": "Strategy", "icon": "♟️"},
    {"id": "2 Player", "name": "2 Player", "icon": "👫"},
    {"id": "3D", "name": "3D", "icon": "🎲"},
]

class GMZGameImport(BaseModel):
    gmz_game_id: str
    title: str
    description: Optional[str] = None
    category: str = "Action"
    thumbnail_url: Optional[str] = None  # 512x384 landscape banner
    icon_url: Optional[str] = None  # 512x512 square icon
    thumbnail_large_url: Optional[str] = None  # 512x340 wide banner
    play_url: str
    instructions: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    tags: Optional[str] = None

def _derive_gmz_image_urls(thumbnail_url: Optional[str]) -> dict:
    """Derive all GameMonetize image URLs from the thumbnail URL hash."""
    result = {"thumbnail_wide_url": None, "logo_url": None, "banner_url": None}
    if not thumbnail_url:
        return result
    # Extract hash from URL like https://img.gamemonetize.com/{hash}/512x384.jpg
    try:
        parts = thumbnail_url.split("/")
        # Find the hash (the part before the filename)
        hash_idx = -2  # e.g. [..., 'img.gamemonetize.com', '{hash}', '512x384.jpg']
        game_hash = parts[hash_idx]
        if game_hash and len(game_hash) > 10:
            result["thumbnail_wide_url"] = f"https://img.gamemonetize.com/{game_hash}/512x340.jpg"
            result["logo_url"] = f"https://uncached.gamemonetize.co/{game_hash}/@base/logo.png"
            result["banner_url"] = f"https://uncached.gamemonetize.co/{game_hash}/@base/banner.jpg"
    except (IndexError, AttributeError):
        pass
    return result

@api_router.get("/gamemonetize/browse")
async def browse_gamemonetize_games(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "newest",
    page: int = 1,
    num: int = 50,
    exclude_imported: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Browse all games from GameMonetize feed (cached, locally paginated)"""
    try:
        all_games = await _fetch_full_gmz_feed()

        if exclude_imported:
            result = await db.execute(
                select(Game.gd_game_id).where(
                    Game.source == "gamemonetize",
                    Game.gd_game_id.is_not(None),
                )
            )
            existing_ids = {gd_game_id for gd_game_id in result.scalars().all() if gd_game_id}
            all_games = [
                g for g in all_games
                if f"gmz-{g.get('id', '')}" not in existing_ids
            ]

        # Apply category filter
        if category and category.lower() != "all":
            all_games = [g for g in all_games if g.get("category", "").lower() == category.lower()]

        # Apply search filter
        if search:
            search_lower = search.lower()
            all_games = [g for g in all_games if
                search_lower in g.get("title", "").lower() or
                search_lower in g.get("tags", "").lower() or
                search_lower in g.get("description", "").lower()
            ]

        # Apply sorting
        if sort == "newest":
            all_games = sorted(all_games, key=lambda x: int(x.get("id", 0)), reverse=True)
        elif sort == "oldest":
            all_games = sorted(all_games, key=lambda x: int(x.get("id", 0)), reverse=False)
        elif sort == "title_asc":
            all_games = sorted(all_games, key=lambda x: x.get("title", "").lower())
        elif sort == "title_desc":
            all_games = sorted(all_games, key=lambda x: x.get("title", "").lower(), reverse=True)

        # Paginate
        total = len(all_games)
        start_idx = (page - 1) * num
        end_idx = start_idx + num
        page_games = all_games[start_idx:end_idx]

        # Format games
        games = []
        for g in page_games:
            thumb_url = g.get("thumb", "")
            base_url = ""
            if thumb_url:
                parts = thumb_url.rsplit("/", 1)
                if len(parts) == 2:
                    base_url = parts[0]

            games.append({
                "gmz_game_id": g.get("id", ""),
                "title": g.get("title", "Unknown"),
                "description": g.get("description", ""),
                "category": g.get("category", "Action"),
                "thumbnail_url": f"{base_url}/512x384.jpg" if base_url else thumb_url,
                "icon_url": f"{base_url}/512x512.jpg" if base_url else thumb_url,
                "thumbnail_large_url": f"{base_url}/512x340.jpg" if base_url else thumb_url,
                "play_url": g.get("url", ""),
                "instructions": g.get("instructions", ""),
                "tags": g.get("tags", ""),
                "width": int(g.get("width", 800)) if g.get("width") else 800,
                "height": int(g.get("height", 600)) if g.get("height") else 600,
            })

        return {
            "games": games,
            "total": total,
            "page": page,
            "num": num,
            "has_more": end_idx < total
        }

    except Exception as e:
        logger.error(f"Error fetching GameMonetize games: {e}")
        return {"games": [], "total": 0, "page": page, "num": num, "error": str(e)}

@api_router.get("/gamemonetize/categories")
async def get_gamemonetize_categories():
    """Get available GameMonetize categories"""
    return {"categories": GAMEMONETIZE_CATEGORIES}

@api_router.post("/admin/gamemonetize/import")
async def import_gamemonetize_game(
    game_data: GMZGameImport,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Import a single game from GameMonetize"""
    # Check if already imported
    gd_game_id = f"gmz-{game_data.gmz_game_id}"
    result = await db.execute(select(Game).where(Game.gd_game_id == gd_game_id))
    existing = result.scalar_one_or_none()
    
    if existing:
        return {"success": False, "message": "Game already imported", "game_id": existing.id}
    
    # Create new game with proper image URLs
    extra_imgs = _derive_gmz_image_urls(game_data.thumbnail_url)
    new_game = Game(
        id=str(uuid.uuid4()),
        title=game_data.title,
        description=game_data.description or "",
        category=game_data.category.title(),
        thumbnail_url=game_data.thumbnail_url,  # 512x384 landscape
        icon_url=game_data.icon_url,  # 512x512 square
        thumbnail_wide_url=extra_imgs["thumbnail_wide_url"],  # 512x340 wide
        logo_url=extra_imgs["logo_url"],  # transparent logo
        banner_url=extra_imgs["banner_url"],  # hero banner
        embed_url=game_data.play_url,
        source="gamemonetize",
        gd_game_id=gd_game_id,
        is_visible=True,
        has_game_file=True,
        instructions=game_data.instructions,
        play_count=0
    )
    
    db.add(new_game)
    await db.commit()
    _invalidate_all_game_caches()
    logger.info(f"Imported GameMonetize game: {new_game.title} (ID: {new_game.id})")
    
    return {"success": True, "game_id": new_game.id, "title": new_game.title}

@api_router.post("/admin/gamemonetize/bulk-import")
async def bulk_import_gamemonetize_games(
    games: List[GMZGameImport],
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk import games from GameMonetize"""
    imported = []
    skipped = []
    
    for game_data in games:
        gd_game_id = f"gmz-{game_data.gmz_game_id}"
        
        # Check if already exists
        result = await db.execute(select(Game).where(Game.gd_game_id == gd_game_id))
        existing = result.scalar_one_or_none()
        
        if existing:
            skipped.append(game_data.title)
            continue
        
        # Create new game with proper image URLs
        extra_imgs = _derive_gmz_image_urls(game_data.thumbnail_url)
        new_game = Game(
            id=str(uuid.uuid4()),
            title=game_data.title,
            description=game_data.description or "",
            category=game_data.category.title(),
            thumbnail_url=game_data.thumbnail_url,  # 512x384 landscape banner
            icon_url=game_data.icon_url,  # 512x512 square icon
            thumbnail_wide_url=extra_imgs["thumbnail_wide_url"],  # 512x340 wide
            logo_url=extra_imgs["logo_url"],  # transparent logo
            banner_url=extra_imgs["banner_url"],  # hero banner
            embed_url=game_data.play_url,
            source="gamemonetize",
            gd_game_id=gd_game_id,
            is_visible=True,
            has_game_file=True,
            instructions=game_data.instructions,
            play_count=0
        )
        
        db.add(new_game)
        imported.append(game_data.title)
    
    await db.commit()
    _invalidate_all_game_caches()
    logger.info(f"Bulk imported {len(imported)} GameMonetize games")
    
    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "imported_games": imported,
        "skipped_games": skipped
    }

@api_router.post("/admin/gamemonetize/sync-new")
async def sync_new_gamemonetize_games(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Fetch the latest GMZ feed and import only games not already in the DB. Returns a summary."""
    all_gmz = await _fetch_full_gmz_feed()
    if not all_gmz:
        return {"imported": 0, "message": "GameMonetize feed unavailable — try again shortly."}

    # Get all existing gd_game_ids in one query
    result = await db.execute(select(Game.gd_game_id).where(Game.source == "gamemonetize"))
    existing_ids: set = {row[0] for row in result.all() if row[0]}

    new_games = [g for g in all_gmz if f"gmz-{g.get('id', '')}" not in existing_ids]

    imported, skipped = [], []
    for g in new_games:
        try:
            gmz_id = str(g.get("id", ""))
            if not gmz_id:
                continue
            thumb_url = g.get("thumb", "")
            base_url = thumb_url.rsplit("/", 1)[0] if thumb_url and "/" in thumb_url else ""
            thumbnail = f"{base_url}/512x384.jpg" if base_url else thumb_url
            icon = f"{base_url}/512x512.jpg" if base_url else thumb_url

            extra_imgs = _derive_gmz_image_urls(thumbnail)
            new_game = Game(
                id=str(uuid.uuid4()),
                title=g.get("title", "Unknown"),
                description=g.get("description", ""),
                category=(g.get("category") or "Action").title(),
                thumbnail_url=thumbnail,
                icon_url=icon,
                thumbnail_wide_url=extra_imgs["thumbnail_wide_url"],
                logo_url=extra_imgs["logo_url"],
                banner_url=extra_imgs["banner_url"],
                embed_url=g.get("url", ""),
                source="gamemonetize",
                gd_game_id=f"gmz-{gmz_id}",
                is_visible=True,
                has_game_file=True,
                instructions=g.get("instructions", ""),
                play_count=0,
            )
            db.add(new_game)
            imported.append(g.get("title", "Unknown"))
        except Exception as e:
            logger.warning(f"sync-new: skipped game {g.get('title')}: {e}")
            skipped.append(g.get("title", ""))

    if imported:
        await db.commit()
        _invalidate_all_game_caches()
        logger.info(f"GMZ sync-new: imported {len(imported)} games, skipped {len(skipped)}")

    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "total_in_feed": len(all_gmz),
        "message": f"Imported {len(imported)} new games." if imported else "Already up to date — no new games found.",
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

    limit = max(1, min(limit, 50))
    result = await db.execute(
        select(
            User.id,
            User.username,
            User.avatar_url,
            User.total_games_played,
            User.total_play_time,
        )
        .where(User.username.ilike(f"%{q}%"))
        .where(User.id != user.id)
        .limit(limit)
    )
    user_rows = result.all()
    if not user_rows:
        return {"users": []}

    user_ids = [row.id for row in user_rows]
    friendship_result = await db.execute(
        select(
            Friendship.requester_id,
            Friendship.addressee_id,
            Friendship.status,
        ).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id.in_(user_ids)),
                and_(Friendship.addressee_id == user.id, Friendship.requester_id.in_(user_ids)),
            )
        )
    )

    friendship_status_by_user: dict[str, str] = {}
    for requester_id, addressee_id, friendship_status in friendship_result.all():
        other_user_id = addressee_id if requester_id == user.id else requester_id
        status = "none"
        if friendship_status == FriendshipStatus.ACCEPTED:
            status = "friends"
        elif friendship_status == FriendshipStatus.PENDING:
            status = "pending_sent" if requester_id == user.id else "pending_received"
        friendship_status_by_user[other_user_id] = status

    return {
        "users": [
            {
                **_public_user_summary(row),
                "friendship_status": friendship_status_by_user.get(row.id, "none"),
            }
            for row in user_rows
        ]
    }

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

    friend_ids = [
        f.addressee_id if f.requester_id == user.id else f.requester_id
        for f in friendships
    ]
    if not friend_ids:
        return {"friends": []}

    friend_rows = await db.execute(
        select(
            User.id,
            User.username,
            User.avatar_url,
            User.total_games_played,
            User.total_play_time,
        ).where(User.id.in_(friend_ids))
    )
    friends_by_id = {row.id: _public_user_summary(row) for row in friend_rows.all()}

    return {"friends": [friends_by_id[friend_id] for friend_id in friend_ids if friend_id in friends_by_id]}

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

    requester_ids = [r.requester_id for r in requests]
    if not requester_ids:
        return {"requests": []}

    requester_rows = await db.execute(
        select(
            User.id,
            User.username,
            User.avatar_url,
            User.total_games_played,
            User.total_play_time,
        ).where(User.id.in_(requester_ids))
    )
    requester_by_id = {row.id: _public_user_summary(row) for row in requester_rows.all()}

    pending = [
        {
            "request_id": r.id,
            "user": requester_by_id[r.requester_id],
            "created_at": r.created_at.isoformat()
        }
        for r in requests
        if r.requester_id in requester_by_id
    ]

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
    limit = max(1, min(limit, 100))
    cache_key = f"leaderboard:global:{limit}"
    cached = _cache_get(cache_key, ttl=120)
    if cached is not None:
        response = JSONResponse(content={"leaderboard": cached, "cached": True})
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
        return response
    
    result = await db.execute(
        select(
            User.id,
            User.username,
            User.avatar_url,
            User.total_games_played,
            User.total_play_time,
        )
        .order_by(desc(User.total_games_played), desc(User.total_play_time))
        .limit(limit)
    )
    users = result.all()
    
    leaderboard = []
    for i, user_row in enumerate(users, 1):
        leaderboard.append({
            "rank": i,
            "user": {"id": user_row.id, "username": user_row.username, "avatar_url": user_row.avatar_url},
            "total_games": user_row.total_games_played or 0,
            "total_time": user_row.total_play_time or 0
        })
    
    _cache_set(cache_key, leaderboard)
    
    response = JSONResponse(content={"leaderboard": leaderboard, "cached": False})
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    return response

@api_router.get("/leaderboard/game/{game_id}")
async def get_game_leaderboard(
    game_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard for a specific game"""
    limit = max(1, min(limit, 100))
    cache_key = f"leaderboard:game:{game_id}:{limit}"
    cached = _cache_get(cache_key, ttl=120)
    if cached is not None:
        response = JSONResponse(content={"leaderboard": cached, "cached": True})
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
        return response
    
    # Only fetch users who have high_scores (filter in DB where possible)
    result = await db.execute(
        select(User.id, User.username, User.avatar_url, User.high_scores).where(User.high_scores.is_not(None))
    )
    users = result.all()
    
    scores = []
    for user_row in users:
        if user_row.high_scores and game_id in user_row.high_scores:
            scores.append({
                "user": {"id": user_row.id, "username": user_row.username, "avatar_url": user_row.avatar_url},
                "score": user_row.high_scores[game_id]
            })
    
    scores.sort(key=lambda x: x["score"], reverse=True)
    scores = scores[:limit]
    leaderboard = [{"rank": i + 1, **s} for i, s in enumerate(scores)]
    
    _cache_set(cache_key, leaderboard)
    
    response = JSONResponse(content={"leaderboard": leaderboard, "cached": False})
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    return response

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
# ==================== IDLE GAME ENDPOINTS ====================

class IdleGameSaveRequest(BaseModel):
    state: dict

@app.get("/api/idle-game/state")
async def get_idle_game_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Load the user's idle game state"""
    user_id = current_user.id
    result = await db.execute(
        select(IdleGameState).where(IdleGameState.user_id == user_id)
    )
    game_state = result.scalar_one_or_none()
    if game_state:
        return {"state": game_state.state_json}
    return {"state": None}

@app.post("/api/idle-game/save")
async def save_idle_game_state(
    request: IdleGameSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save the user's idle game state"""
    user_id = current_user.id
    result = await db.execute(
        select(IdleGameState).where(IdleGameState.user_id == user_id)
    )
    game_state = result.scalar_one_or_none()
    
    if game_state:
        game_state.state_json = request.state
        game_state.updated_at = datetime.now(timezone.utc)
    else:
        game_state = IdleGameState(
            user_id=user_id,
            state_json=request.state,
        )
        db.add(game_state)
    
    await db.commit()
    return {"success": True}

# ==================== END IDLE GAME ====================

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
    # Auto-create any missing tables (e.g. comment_likes added in latest version)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Initialize storage buckets
    init_storage_buckets()
    logger.info("Skipping background cache pre-warm to keep Railway memory stable")

# Root redirect
@app.get("/")
async def root():
    return {"message": "Hypd Games API", "docs": "/docs", "database": "postgresql", "storage": "supabase"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
