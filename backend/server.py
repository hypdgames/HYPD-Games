"""
Hypd Games API Server
Backend powered by FastAPI + Supabase PostgreSQL + Supabase Storage
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client, Client
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
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

# Local imports
from database import get_db, engine, Base
from models import User, Game, PlaySession, AppSettings

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging (must be early for other initializations)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'hypd-games-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

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

# ==================== PYDANTIC MODELS ====================

class UserCreate(BaseModel):
    username: str
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

class GameCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "Action"
    thumbnail_url: Optional[str] = None
    preview_type: str = "image"

class GameResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    thumbnail_url: Optional[str] = None
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
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
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
    
    token = create_token(new_user.id)
    return {"access_token": token, "user": UserResponse(**new_user.to_dict())}

@api_router.post("/auth/login")
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user.id)
    return {"access_token": token, "user": UserResponse(**user.to_dict())}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(**user.to_dict())

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
    response.headers["Cache-Control"] = "public, max-age=60"
    return response

@api_router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return GameResponse(**game.to_dict())

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
    response.headers["Cache-Control"] = "public, max-age=300"
    return response

@api_router.get("/games/{game_id}/play")
async def get_game_file(game_id: str, db: AsyncSession = Depends(get_db)):
    """Serve game HTML content directly (avoids CSP issues from Supabase Storage redirect)"""
    
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Increment play count
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
        .where(Game.is_visible == True)
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
        raise HTTPException(status_code=500, detail=str(e))

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

@api_router.get("/admin/analytics/overview")
async def admin_analytics_overview(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get analytics overview"""
    # Total games
    games_result = await db.execute(select(func.count(Game.id)))
    total_games = games_result.scalar()
    
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar()
    
    # Total plays
    plays_result = await db.execute(select(func.sum(Game.play_count)))
    total_plays = plays_result.scalar() or 0
    
    # Today's sessions
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_result = await db.execute(
        select(func.count(PlaySession.id))
        .where(PlaySession.played_at >= today)
    )
    today_plays = today_result.scalar() or 0
    
    return {
        "total_games": total_games,
        "total_users": total_users,
        "total_plays": int(total_plays),
        "today_plays": today_plays
    }

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
        raise HTTPException(status_code=500, detail=str(e))

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

# ==================== APP SETUP ====================

# Include router
app.include_router(api_router)

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
