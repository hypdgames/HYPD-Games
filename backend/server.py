from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
fs = AsyncIOMotorGridFSBucket(db)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'hypd-games-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Image compression helper
def compress_image(image_data: bytes, max_size: int = 800, quality: int = 75) -> str:
    """Compress and resize image, return as base64 data URL"""
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Resize if too large
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save as JPEG with compression
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        compressed_data = buffer.getvalue()
        
        return f"data:image/jpeg;base64,{base64.b64encode(compressed_data).decode()}"
    except Exception as e:
        logging.error(f"Image compression error: {e}")
        # Fallback to original if compression fails
        return f"data:image/jpeg;base64,{base64.b64encode(image_data).decode()}"

# Create the main app
app = FastAPI(title="Hypd Games API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

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
    is_admin: bool = False
    created_at: str
    saved_games: List[str] = []
    high_scores: dict = {}

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class GameCreate(BaseModel):
    title: str
    description: str
    category: str
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    is_visible: bool = True

class GameResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    is_visible: bool
    play_count: int = 0
    created_at: str
    has_game_file: bool = False

class GameUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    is_visible: Optional[bool] = None

class HighScoreUpdate(BaseModel):
    game_id: str
    score: int

class SettingsResponse(BaseModel):
    logo_url: Optional[str] = None

class PlaySessionCreate(BaseModel):
    game_id: str
    duration_seconds: int = 0
    score: Optional[int] = None

class GameAnalytics(BaseModel):
    game_id: str
    title: str
    total_plays: int
    unique_players: int
    avg_duration: float
    total_play_time: int
    plays_today: int
    plays_this_week: int

class OverallAnalytics(BaseModel):
    total_games: int
    total_plays: int
    total_users: int
    active_users_today: int
    top_games: List[dict]
    plays_by_category: dict
    plays_by_day: List[dict]

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing_username = await db.users.find_one({"username": data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "email": data.email,
        "password": hash_password(data.password),
        "is_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "saved_games": [],
        "high_scores": {}
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_response = UserResponse(
        id=user_id,
        username=data.username,
        email=data.email,
        is_admin=False,
        created_at=user_doc["created_at"],
        saved_games=[],
        high_scores={}
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        is_admin=user.get("is_admin", False),
        created_at=user["created_at"],
        saved_games=user.get("saved_games", []),
        high_scores=user.get("high_scores", {})
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)

@api_router.post("/auth/save-game/{game_id}")
async def save_game(game_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$addToSet": {"saved_games": game_id}}
    )
    return {"message": "Game saved"}

@api_router.delete("/auth/save-game/{game_id}")
async def unsave_game(game_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$pull": {"saved_games": game_id}}
    )
    return {"message": "Game removed from saved"}

@api_router.post("/auth/high-score")
async def update_high_score(data: HighScoreUpdate, user: dict = Depends(get_current_user)):
    current_scores = user.get("high_scores", {})
    current_best = current_scores.get(data.game_id, 0)
    
    if data.score > current_best:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {f"high_scores.{data.game_id}": data.score}}
        )
        return {"message": "New high score!", "score": data.score}
    return {"message": "Score recorded", "score": current_best}

# ==================== GAME ROUTES ====================

@api_router.get("/games", response_model=List[GameResponse])
async def get_games(category: Optional[str] = None, visible_only: bool = True):
    query = {}
    if category and category != "all":
        query["category"] = category
    if visible_only:
        query["is_visible"] = True
    
    games = await db.games.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [GameResponse(**g) for g in games]

@api_router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return GameResponse(**game)

@api_router.get("/games/{game_id}/play")
async def get_game_file(game_id: str):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Increment play count
    await db.games.update_one({"id": game_id}, {"$inc": {"play_count": 1}})
    
    # Get game HTML content from GridFS or embedded
    if game.get("game_file_id"):
        try:
            grid_out = await fs.open_download_stream(ObjectId(game["game_file_id"]))
            content = await grid_out.read()
            
            # Check if content is a ZIP file
            if content[:2] == b'PK':
                try:
                    with zipfile.ZipFile(io.BytesIO(content)) as zf:
                        # Look for index.html or main HTML file
                        html_files = [f for f in zf.namelist() if f.endswith('.html') and not f.startswith('__MACOSX')]
                        
                        if not html_files:
                            raise HTTPException(status_code=404, detail="No HTML file found in ZIP")
                        
                        # Prefer index.html, otherwise use first HTML file
                        html_file = None
                        for f in html_files:
                            if f.endswith('index.html'):
                                html_file = f
                                break
                        if not html_file:
                            html_file = html_files[0]
                        
                        # Get the base path for assets
                        base_path = '/'.join(html_file.split('/')[:-1])
                        if base_path:
                            base_path += '/'
                        
                        html_content = zf.read(html_file).decode('utf-8', errors='ignore')
                        
                        # Inject base tag and inline critical assets
                        base_tag = f'<base href="/api/games/{game_id}/assets/{base_path}">'
                        if '<head>' in html_content:
                            html_content = html_content.replace('<head>', f'<head>\n{base_tag}', 1)
                        elif '<HEAD>' in html_content:
                            html_content = html_content.replace('<HEAD>', f'<HEAD>\n{base_tag}', 1)
                        else:
                            html_content = base_tag + html_content
                        
                        return StreamingResponse(
                            io.BytesIO(html_content.encode()),
                            media_type="text/html",
                            headers={"Content-Disposition": f"inline; filename={game['title']}.html"}
                        )
                except zipfile.BadZipFile:
                    logging.error(f"Invalid ZIP file for game {game_id}")
            else:
                # Regular HTML file
                return StreamingResponse(
                    io.BytesIO(content),
                    media_type="text/html",
                    headers={"Content-Disposition": f"inline; filename={game['title']}.html"}
                )
        except Exception as e:
            logging.error(f"Error reading game file: {e}")
    
    # Return embedded game content if available
    if game.get("game_content"):
        return StreamingResponse(
            io.BytesIO(game["game_content"].encode()),
            media_type="text/html"
        )
    
    raise HTTPException(status_code=404, detail="Game file not found")

@api_router.get("/games/{game_id}/assets/{path:path}")
async def get_game_asset(game_id: str, path: str):
    """Serve assets from ZIP game files"""
    game = await db.games.find_one({"id": game_id})
    if not game or not game.get("game_file_id"):
        raise HTTPException(status_code=404, detail="Game not found")
    
    try:
        grid_out = await fs.open_download_stream(ObjectId(game["game_file_id"]))
        content = await grid_out.read()
        
        if content[:2] != b'PK':
            raise HTTPException(status_code=404, detail="Game is not a ZIP file")
        
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # Try to find the file in the ZIP
            try:
                asset_content = zf.read(path)
            except KeyError:
                raise HTTPException(status_code=404, detail=f"Asset not found: {path}")
            
            # Determine content type with WebGL support
            content_type = "application/octet-stream"
            path_lower = path.lower()
            
            # JavaScript/WASM
            if path_lower.endswith('.js'):
                content_type = "application/javascript"
            elif path_lower.endswith('.mjs'):
                content_type = "application/javascript"
            elif path_lower.endswith('.wasm'):
                content_type = "application/wasm"
            # CSS/HTML
            elif path_lower.endswith('.css'):
                content_type = "text/css"
            elif path_lower.endswith('.html'):
                content_type = "text/html"
            # Data formats
            elif path_lower.endswith('.json'):
                content_type = "application/json"
            elif path_lower.endswith('.xml'):
                content_type = "application/xml"
            elif path_lower.endswith('.bin'):
                content_type = "application/octet-stream"
            elif path_lower.endswith('.data'):
                content_type = "application/octet-stream"
            # Images
            elif path_lower.endswith('.png'):
                content_type = "image/png"
            elif path_lower.endswith(('.jpg', '.jpeg')):
                content_type = "image/jpeg"
            elif path_lower.endswith('.gif'):
                content_type = "image/gif"
            elif path_lower.endswith('.svg'):
                content_type = "image/svg+xml"
            elif path_lower.endswith('.webp'):
                content_type = "image/webp"
            elif path_lower.endswith('.ico'):
                content_type = "image/x-icon"
            elif path_lower.endswith('.bmp'):
                content_type = "image/bmp"
            elif path_lower.endswith('.tga'):
                content_type = "image/x-tga"
            elif path_lower.endswith('.dds'):
                content_type = "image/vnd-ms.dds"
            elif path_lower.endswith('.ktx'):
                content_type = "image/ktx"
            elif path_lower.endswith('.ktx2'):
                content_type = "image/ktx2"
            # Audio
            elif path_lower.endswith('.mp3'):
                content_type = "audio/mpeg"
            elif path_lower.endswith('.wav'):
                content_type = "audio/wav"
            elif path_lower.endswith('.ogg'):
                content_type = "audio/ogg"
            elif path_lower.endswith('.m4a'):
                content_type = "audio/mp4"
            elif path_lower.endswith('.aac'):
                content_type = "audio/aac"
            elif path_lower.endswith('.flac'):
                content_type = "audio/flac"
            # Video
            elif path_lower.endswith('.mp4'):
                content_type = "video/mp4"
            elif path_lower.endswith('.webm'):
                content_type = "video/webm"
            elif path_lower.endswith('.ogv'):
                content_type = "video/ogg"
            # Fonts
            elif path_lower.endswith('.woff'):
                content_type = "font/woff"
            elif path_lower.endswith('.woff2'):
                content_type = "font/woff2"
            elif path_lower.endswith('.ttf'):
                content_type = "font/ttf"
            elif path_lower.endswith('.otf'):
                content_type = "font/otf"
            elif path_lower.endswith('.eot'):
                content_type = "application/vnd.ms-fontobject"
            # 3D/WebGL specific
            elif path_lower.endswith('.glb'):
                content_type = "model/gltf-binary"
            elif path_lower.endswith('.gltf'):
                content_type = "model/gltf+json"
            elif path_lower.endswith('.obj'):
                content_type = "text/plain"
            elif path_lower.endswith('.mtl'):
                content_type = "text/plain"
            elif path_lower.endswith('.fbx'):
                content_type = "application/octet-stream"
            # Unity WebGL specific
            elif path_lower.endswith('.unityweb'):
                content_type = "application/octet-stream"
            elif path_lower.endswith('.mem'):
                content_type = "application/octet-stream"
            elif path_lower.endswith('.symbols.json'):
                content_type = "application/json"
            # Compressed files (for Unity WebGL)
            elif path_lower.endswith('.gz'):
                content_type = "application/gzip"
            elif path_lower.endswith('.br'):
                content_type = "application/x-br"
            # Text files
            elif path_lower.endswith('.txt'):
                content_type = "text/plain"
            elif path_lower.endswith('.md'):
                content_type = "text/markdown"
            elif path_lower.endswith('.csv'):
                content_type = "text/csv"
            
            # Set CORS headers for cross-origin requests
            headers = {
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp"
            }
            
            return StreamingResponse(
                io.BytesIO(asset_content),
                media_type=content_type,
                headers=headers
            )
    except Exception as e:
        logging.error(f"Error reading game asset: {e}")
        raise HTTPException(status_code=500, detail="Error reading game asset")

@api_router.get("/categories")
async def get_categories():
    categories = await db.games.distinct("category")
    return {"categories": categories}

# ==================== ANALYTICS ROUTES ====================

@api_router.post("/analytics/play-session")
async def record_play_session(data: PlaySessionCreate):
    """Record a play session for analytics"""
    session_doc = {
        "id": str(uuid.uuid4()),
        "game_id": data.game_id,
        "duration_seconds": data.duration_seconds,
        "score": data.score,
        "played_at": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    await db.play_sessions.insert_one(session_doc)
    return {"message": "Session recorded"}

@api_router.get("/admin/analytics/overview")
async def get_analytics_overview(user: dict = Depends(get_admin_user)):
    """Get overall platform analytics"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Total counts
    total_games = await db.games.count_documents({})
    total_users = await db.users.count_documents({})
    total_plays = await db.play_sessions.count_documents({})
    
    # Today's stats
    plays_today = await db.play_sessions.count_documents({"date": today})
    
    # Get unique users who played today
    active_users_pipeline = [
        {"$match": {"date": today}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "count"}
    ]
    active_result = await db.play_sessions.aggregate(active_users_pipeline).to_list(1)
    active_users_today = active_result[0]["count"] if active_result else 0
    
    # Top games by play count
    top_games_pipeline = [
        {"$group": {"_id": "$game_id", "plays": {"$sum": 1}, "total_time": {"$sum": "$duration_seconds"}}},
        {"$sort": {"plays": -1}},
        {"$limit": 5}
    ]
    top_games_raw = await db.play_sessions.aggregate(top_games_pipeline).to_list(5)
    
    # Enrich with game titles
    top_games = []
    for tg in top_games_raw:
        game = await db.games.find_one({"id": tg["_id"]}, {"_id": 0, "title": 1, "category": 1, "thumbnail_url": 1})
        if game:
            top_games.append({
                "game_id": tg["_id"],
                "title": game.get("title", "Unknown"),
                "category": game.get("category", "Unknown"),
                "thumbnail_url": game.get("thumbnail_url"),
                "plays": tg["plays"],
                "total_time_minutes": round(tg["total_time"] / 60, 1)
            })
    
    # If no play sessions yet, use play_count from games
    if not top_games:
        games = await db.games.find({}, {"_id": 0}).sort("play_count", -1).limit(5).to_list(5)
        top_games = [{
            "game_id": g["id"],
            "title": g["title"],
            "category": g["category"],
            "thumbnail_url": g.get("thumbnail_url"),
            "plays": g.get("play_count", 0),
            "total_time_minutes": 0
        } for g in games]
    
    # Plays by category
    category_pipeline = [
        {"$group": {"_id": "$game_id", "plays": {"$sum": 1}}},
    ]
    category_raw = await db.play_sessions.aggregate(category_pipeline).to_list(100)
    
    plays_by_category = {}
    for cr in category_raw:
        game = await db.games.find_one({"id": cr["_id"]}, {"_id": 0, "category": 1})
        if game:
            cat = game.get("category", "Other")
            plays_by_category[cat] = plays_by_category.get(cat, 0) + cr["plays"]
    
    # If no sessions, use game play_count
    if not plays_by_category:
        games = await db.games.find({}, {"_id": 0, "category": 1, "play_count": 1}).to_list(100)
        for g in games:
            cat = g.get("category", "Other")
            plays_by_category[cat] = plays_by_category.get(cat, 0) + g.get("play_count", 0)
    
    # Plays by day (last 7 days)
    plays_by_day = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        day_label = (now - timedelta(days=i)).strftime("%a")
        count = await db.play_sessions.count_documents({"date": day})
        plays_by_day.append({"date": day, "day": day_label, "plays": count})
    
    return {
        "total_games": total_games,
        "total_plays": total_plays or sum(g.get("play_count", 0) for g in await db.games.find({}, {"_id": 0, "play_count": 1}).to_list(100)),
        "total_users": total_users,
        "active_users_today": active_users_today,
        "plays_today": plays_today,
        "top_games": top_games,
        "plays_by_category": plays_by_category,
        "plays_by_day": plays_by_day
    }

@api_router.get("/admin/analytics/game/{game_id}")
async def get_game_analytics(game_id: str, user: dict = Depends(get_admin_user)):
    """Get detailed analytics for a specific game"""
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Session stats
    sessions = await db.play_sessions.find({"game_id": game_id}, {"_id": 0}).to_list(1000)
    
    total_plays = len(sessions)
    total_duration = sum(s.get("duration_seconds", 0) for s in sessions)
    avg_duration = total_duration / total_plays if total_plays > 0 else 0
    
    # Unique players
    unique_players = len(set(s.get("user_id", s.get("id")) for s in sessions))
    
    # Today and week stats
    plays_today = sum(1 for s in sessions if s.get("date") == today)
    plays_this_week = sum(1 for s in sessions if s.get("date", "") >= week_ago)
    
    # Daily breakdown
    daily_plays = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        day_label = (now - timedelta(days=i)).strftime("%a")
        count = sum(1 for s in sessions if s.get("date") == day)
        daily_plays.append({"date": day, "day": day_label, "plays": count})
    
    # Score distribution (if scores tracked)
    scores = [s.get("score") for s in sessions if s.get("score") is not None]
    score_stats = {
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "high_score": max(scores) if scores else 0,
        "total_scored_sessions": len(scores)
    }
    
    return {
        "game_id": game_id,
        "title": game["title"],
        "category": game["category"],
        "total_plays": total_plays or game.get("play_count", 0),
        "unique_players": unique_players,
        "avg_duration_seconds": round(avg_duration, 1),
        "total_play_time_minutes": round(total_duration / 60, 1),
        "plays_today": plays_today,
        "plays_this_week": plays_this_week,
        "daily_plays": daily_plays,
        "score_stats": score_stats
    }

@api_router.get("/admin/analytics/retention")
async def get_retention_analytics(user: dict = Depends(get_admin_user)):
    """Get user retention metrics and cohort analysis"""
    now = datetime.now(timezone.utc)
    
    # Get all users with their creation dates
    users = await db.users.find({}, {"_id": 0, "id": 1, "created_at": 1}).to_list(1000)
    
    # Get all play sessions
    sessions = await db.play_sessions.find({}, {"_id": 0, "user_id": 1, "date": 1, "game_id": 1}).to_list(10000)
    
    # Build user activity map
    user_activity = {}
    for session in sessions:
        user_id = session.get("user_id")
        if user_id:
            if user_id not in user_activity:
                user_activity[user_id] = set()
            user_activity[user_id].add(session.get("date", ""))
    
    # Calculate retention metrics
    retention_data = {
        "day_1": 0,
        "day_7": 0,
        "day_30": 0,
        "total_users_with_activity": len(user_activity)
    }
    
    for user in users:
        user_id = user.get("id")
        if user_id not in user_activity:
            continue
            
        try:
            created_date = datetime.fromisoformat(user["created_at"].replace("Z", "+00:00"))
            activity_dates = user_activity.get(user_id, set())
            
            # Check if user returned on specific days
            day_1 = (created_date + timedelta(days=1)).strftime("%Y-%m-%d")
            day_7 = (created_date + timedelta(days=7)).strftime("%Y-%m-%d")
            day_30 = (created_date + timedelta(days=30)).strftime("%Y-%m-%d")
            
            if day_1 in activity_dates:
                retention_data["day_1"] += 1
            if day_7 in activity_dates:
                retention_data["day_7"] += 1
            if day_30 in activity_dates:
                retention_data["day_30"] += 1
        except (ValueError, KeyError, TypeError):
            continue
    
    total_users = len(users) or 1
    retention_data["day_1_rate"] = round(retention_data["day_1"] / total_users * 100, 1)
    retention_data["day_7_rate"] = round(retention_data["day_7"] / total_users * 100, 1)
    retention_data["day_30_rate"] = round(retention_data["day_30"] / total_users * 100, 1)
    
    # Cohort analysis - users grouped by signup week
    cohorts = {}
    for user in users:
        try:
            created_date = datetime.fromisoformat(user["created_at"].replace("Z", "+00:00"))
            week_start = (created_date - timedelta(days=created_date.weekday())).strftime("%Y-%m-%d")
            
            if week_start not in cohorts:
                cohorts[week_start] = {"total": 0, "active_week_1": 0, "active_week_2": 0, "active_week_3": 0, "active_week_4": 0}
            
            cohorts[week_start]["total"] += 1
            
            user_id = user.get("id")
            if user_id in user_activity:
                activity_dates = user_activity[user_id]
                for week_num in range(1, 5):
                    # Check if user was active during that week
                    for date_str in activity_dates:
                        try:
                            activity_date = datetime.strptime(date_str, "%Y-%m-%d")
                            week_start_check = created_date + timedelta(weeks=week_num-1)
                            week_end_check = created_date + timedelta(weeks=week_num)
                            if week_start_check <= activity_date.replace(tzinfo=timezone.utc) < week_end_check:
                                cohorts[week_start][f"active_week_{week_num}"] += 1
                                break
                        except (ValueError, TypeError):
                            continue
        except (ValueError, KeyError, TypeError):
            continue
    
    # Format cohorts for response
    cohort_list = []
    for week, data in sorted(cohorts.items(), reverse=True)[:8]:
        total = data["total"] or 1
        cohort_list.append({
            "week": week,
            "total_users": data["total"],
            "week_1_retention": round(data["active_week_1"] / total * 100, 1),
            "week_2_retention": round(data["active_week_2"] / total * 100, 1),
            "week_3_retention": round(data["active_week_3"] / total * 100, 1),
            "week_4_retention": round(data["active_week_4"] / total * 100, 1)
        })
    
    # Daily active users trend (last 30 days)
    dau_trend = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        day_label = (now - timedelta(days=i)).strftime("%b %d")
        active_users = set()
        for session in sessions:
            if session.get("date") == day and session.get("user_id"):
                active_users.add(session["user_id"])
        dau_trend.append({
            "date": day,
            "label": day_label,
            "dau": len(active_users)
        })
    
    # Calculate average session duration and sessions per user
    total_sessions = len(sessions)
    avg_sessions_per_user = round(total_sessions / len(user_activity), 1) if user_activity else 0
    
    return {
        "retention": retention_data,
        "cohorts": cohort_list,
        "dau_trend": dau_trend,
        "metrics": {
            "total_users": len(users),
            "active_users": len(user_activity),
            "avg_sessions_per_user": avg_sessions_per_user
        }
    }

@api_router.get("/admin/analytics/export/csv")
async def export_analytics_csv(user: dict = Depends(get_admin_user)):
    """Export analytics data as CSV"""
    import csv
    
    now = datetime.now(timezone.utc)
    
    # Get all data
    games = await db.games.find({}, {"_id": 0}).to_list(100)
    sessions = await db.play_sessions.find({}, {"_id": 0}).to_list(10000)
    users = await db.users.find({}, {"_id": 0, "id": 1, "username": 1, "email": 1, "created_at": 1}).to_list(1000)
    
    # Build CSV content
    output = io.StringIO()
    
    # Section 1: Overview
    output.write("HYPD Games Analytics Report\n")
    output.write(f"Generated: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n")
    
    output.write("=== OVERVIEW ===\n")
    output.write(f"Total Games,{len(games)}\n")
    output.write(f"Total Users,{len(users)}\n")
    output.write(f"Total Play Sessions,{len(sessions)}\n\n")
    
    # Section 2: Games Performance
    output.write("=== GAMES PERFORMANCE ===\n")
    output.write("Game Title,Category,Play Count,Has Game File,Created At\n")
    for game in games:
        output.write(f'"{game.get("title", "")}",{game.get("category", "")},{game.get("play_count", 0)},{game.get("has_game_file", False)},{game.get("created_at", "")}\n')
    
    output.write("\n")
    
    # Section 3: Daily Plays (last 30 days)
    output.write("=== DAILY PLAYS (Last 30 Days) ===\n")
    output.write("Date,Play Count\n")
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        count = sum(1 for s in sessions if s.get("date") == day)
        output.write(f"{day},{count}\n")
    
    output.write("\n")
    
    # Section 4: Category Breakdown
    output.write("=== PLAYS BY CATEGORY ===\n")
    output.write("Category,Play Count\n")
    category_counts = {}
    for game in games:
        cat = game.get("category", "Other")
        category_counts[cat] = category_counts.get(cat, 0) + game.get("play_count", 0)
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        output.write(f"{cat},{count}\n")
    
    output.write("\n")
    
    # Section 5: User Registrations
    output.write("=== USER REGISTRATIONS ===\n")
    output.write("Date,New Users\n")
    reg_by_date = {}
    for user in users:
        try:
            created = user.get("created_at", "")[:10]
            reg_by_date[created] = reg_by_date.get(created, 0) + 1
        except (TypeError, IndexError):
            continue
    for date, count in sorted(reg_by_date.items(), reverse=True)[:30]:
        output.write(f"{date},{count}\n")
    
    csv_content = output.getvalue()
    output.close()
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="hypd_analytics_{now.strftime("%Y%m%d")}.csv"'
        }
    )

@api_router.get("/admin/analytics/export/json")
async def export_analytics_json(user: dict = Depends(get_admin_user)):
    """Export full analytics data as JSON"""
    import json
    
    now = datetime.now(timezone.utc)
    
    # Get all data
    games = await db.games.find({}, {"_id": 0}).to_list(100)
    sessions = await db.play_sessions.find({}, {"_id": 0}).to_list(10000)
    users_count = await db.users.count_documents({})
    
    # Build export data
    export_data = {
        "generated_at": now.isoformat(),
        "overview": {
            "total_games": len(games),
            "total_users": users_count,
            "total_sessions": len(sessions)
        },
        "games": [{
            "id": g.get("id"),
            "title": g.get("title"),
            "category": g.get("category"),
            "play_count": g.get("play_count", 0),
            "created_at": g.get("created_at")
        } for g in games],
        "daily_plays": []
    }
    
    # Daily plays
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        count = sum(1 for s in sessions if s.get("date") == day)
        export_data["daily_plays"].append({"date": day, "plays": count})
    
    json_content = json.dumps(export_data, indent=2)
    
    return StreamingResponse(
        io.BytesIO(json_content.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="hypd_analytics_{now.strftime("%Y%m%d")}.json"'
        }
    )

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/games", response_model=GameResponse)
async def create_game(data: GameCreate, user: dict = Depends(get_admin_user)):
    game_id = str(uuid.uuid4())
    game_doc = {
        "id": game_id,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "thumbnail_url": data.thumbnail_url,
        "video_url": data.video_url,
        "is_visible": data.is_visible,
        "play_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_game_file": False
    }
    
    await db.games.insert_one(game_doc)
    return GameResponse(**game_doc)

@api_router.put("/admin/games/{game_id}", response_model=GameResponse)
async def update_game(game_id: str, data: GameUpdate, user: dict = Depends(get_admin_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.games.update_one({"id": game_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    return GameResponse(**game)

@api_router.delete("/admin/games/{game_id}")
async def delete_game(game_id: str, user: dict = Depends(get_admin_user)):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Delete game file from GridFS if exists
    if game.get("game_file_id"):
        try:
            await fs.delete(ObjectId(game["game_file_id"]))
        except Exception:
            pass
    
    await db.games.delete_one({"id": game_id})
    return {"message": "Game deleted"}

@api_router.post("/admin/games/{game_id}/upload")
async def upload_game_file(
    game_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_admin_user)
):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Delete old file if exists
    if game.get("game_file_id"):
        try:
            await fs.delete(ObjectId(game["game_file_id"]))
        except Exception:
            pass
    
    # Read and store new file
    content = await file.read()
    file_id = await fs.upload_from_stream(
        f"{game_id}_{file.filename}",
        io.BytesIO(content),
        metadata={"game_id": game_id, "filename": file.filename}
    )
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {"game_file_id": str(file_id), "has_game_file": True}}
    )
    
    return {"message": "Game file uploaded", "file_id": str(file_id)}

@api_router.post("/admin/games/{game_id}/content")
async def set_game_content(
    game_id: str,
    content: str = Form(...),
    user: dict = Depends(get_admin_user)
):
    """Set embedded HTML content for a game (for sample games)"""
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {"game_content": content, "has_game_file": True}}
    )
    
    return {"message": "Game content set"}

@api_router.get("/admin/games", response_model=List[GameResponse])
async def get_all_games_admin(user: dict = Depends(get_admin_user)):
    games = await db.games.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [GameResponse(**g) for g in games]

@api_router.post("/admin/toggle-visibility/{game_id}")
async def toggle_game_visibility(game_id: str, user: dict = Depends(get_admin_user)):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    new_visibility = not game.get("is_visible", True)
    await db.games.update_one({"id": game_id}, {"$set": {"is_visible": new_visibility}})
    
    return {"message": f"Game {'shown' if new_visibility else 'hidden'}", "is_visible": new_visibility}

@api_router.post("/admin/games/create-with-files")
async def create_game_with_files(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    is_visible: bool = Form(True),
    game_file: Optional[UploadFile] = File(None),
    thumbnail_file: Optional[UploadFile] = File(None),
    explore_image_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_admin_user)
):
    """Create a game with file uploads for game, thumbnail, and explore image"""
    game_id = str(uuid.uuid4())
    
    # Process thumbnail image with compression
    thumbnail_url = None
    if thumbnail_file and thumbnail_file.filename:
        content = await thumbnail_file.read()
        thumbnail_url = compress_image(content, max_size=800, quality=75)
    
    # Process explore image with compression (can be same as thumbnail or different)
    explore_image_url = None
    if explore_image_file and explore_image_file.filename:
        content = await explore_image_file.read()
        explore_image_url = compress_image(content, max_size=400, quality=70)
    else:
        explore_image_url = thumbnail_url  # Default to thumbnail if not provided
    
    game_doc = {
        "id": game_id,
        "title": title,
        "description": description,
        "category": category,
        "thumbnail_url": thumbnail_url,
        "explore_image_url": explore_image_url,
        "video_url": None,
        "is_visible": is_visible,
        "play_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_game_file": False
    }
    
    # Process game file
    if game_file and game_file.filename:
        content = await game_file.read()
        file_id = await fs.upload_from_stream(
            f"{game_id}_{game_file.filename}",
            io.BytesIO(content),
            metadata={"game_id": game_id, "filename": game_file.filename}
        )
        game_doc["game_file_id"] = str(file_id)
        game_doc["has_game_file"] = True
    
    await db.games.insert_one(game_doc)
    
    return {
        "id": game_id,
        "title": title,
        "description": description,
        "category": category,
        "thumbnail_url": thumbnail_url,
        "explore_image_url": explore_image_url,
        "video_url": None,
        "is_visible": is_visible,
        "play_count": 0,
        "created_at": game_doc["created_at"],
        "has_game_file": game_doc["has_game_file"]
    }

@api_router.put("/admin/games/{game_id}/update-with-files")
async def update_game_with_files(
    game_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    is_visible: Optional[bool] = Form(None),
    game_file: Optional[UploadFile] = File(None),
    thumbnail_file: Optional[UploadFile] = File(None),
    explore_image_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_admin_user)
):
    """Update a game with optional file uploads"""
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    update_data = {}
    
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if category is not None:
        update_data["category"] = category
    if is_visible is not None:
        update_data["is_visible"] = is_visible
    
    # Process thumbnail image with compression
    if thumbnail_file and thumbnail_file.filename:
        content = await thumbnail_file.read()
        update_data["thumbnail_url"] = compress_image(content, max_size=800, quality=75)
    
    # Process explore image with compression
    if explore_image_file and explore_image_file.filename:
        content = await explore_image_file.read()
        update_data["explore_image_url"] = compress_image(content, max_size=400, quality=70)
    
    # Process game file
    if game_file and game_file.filename:
        # Delete old file if exists
        if game.get("game_file_id"):
            try:
                await fs.delete(ObjectId(game["game_file_id"]))
            except Exception:
                pass
        
        content = await game_file.read()
        file_id = await fs.upload_from_stream(
            f"{game_id}_{game_file.filename}",
            io.BytesIO(content),
            metadata={"game_id": game_id, "filename": game_file.filename}
        )
        update_data["game_file_id"] = str(file_id)
        update_data["has_game_file"] = True
    
    if update_data:
        await db.games.update_one({"id": game_id}, {"$set": update_data})
    
    updated_game = await db.games.find_one({"id": game_id}, {"_id": 0})
    return GameResponse(**updated_game)

# ==================== SETTINGS ROUTES ====================

@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    settings = await db.settings.find_one({"key": "site_settings"}, {"_id": 0})
    if not settings:
        return SettingsResponse()
    return SettingsResponse(logo_url=settings.get("logo_url"))

@api_router.post("/admin/settings/logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    content = await file.read()
    # Store as base64 for simplicity
    logo_data = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    
    await db.settings.update_one(
        {"key": "site_settings"},
        {"$set": {"logo_url": logo_data}},
        upsert=True
    )
    
    return {"message": "Logo uploaded", "logo_url": logo_data}

# ==================== SEED DATA ====================

@api_router.post("/admin/seed")
async def seed_sample_games(user: dict = Depends(get_admin_user)):
    """Seed sample games for demo"""
    sample_games = [
        {
            "id": str(uuid.uuid4()),
            "title": "Neon Blocks",
            "description": "Classic block stacking puzzle with a neon twist. Stack the falling blocks to clear lines!",
            "category": "Puzzle",
            "thumbnail_url": "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=800&q=80",
            "is_visible": True,
            "play_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_game_file": True,
            "game_content": NEON_BLOCKS_GAME
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Space Dodge",
            "description": "Pilot your ship through an asteroid field. How long can you survive?",
            "category": "Action",
            "thumbnail_url": "https://images.unsplash.com/photo-1590034295051-004f272713a4?w=800&q=80",
            "is_visible": True,
            "play_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_game_file": True,
            "game_content": SPACE_DODGE_GAME
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Color Match",
            "description": "Match colors as fast as you can! Test your reflexes in this addictive tapper.",
            "category": "Arcade",
            "thumbnail_url": "https://images.unsplash.com/photo-1721987203048-24725e93047e?w=800&q=80",
            "is_visible": True,
            "play_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_game_file": True,
            "game_content": COLOR_MATCH_GAME
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Cyber Runner",
            "description": "Run through the neon city, dodge obstacles and collect power-ups!",
            "category": "Action",
            "thumbnail_url": "https://images.unsplash.com/photo-1684536689765-c4ebf55da2ae?w=800&q=80",
            "is_visible": True,
            "play_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_game_file": True,
            "game_content": CYBER_RUNNER_GAME
        }
    ]
    
    # Clear existing games
    await db.games.delete_many({})
    
    # Insert sample games
    await db.games.insert_many(sample_games)
    
    return {"message": f"Seeded {len(sample_games)} sample games"}

# ==================== SAMPLE GAME HTML ====================

NEON_BLOCKS_GAME = '''<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui;touch-action:none}
#game{position:relative}canvas{border:2px solid #CCFF00;border-radius:8px}#score{position:absolute;top:-40px;left:0;color:#CCFF00;font-size:20px;font-weight:bold}
#controls{position:absolute;bottom:-80px;left:50%;transform:translateX(-50%);display:flex;gap:15px}
.btn{width:60px;height:60px;background:rgba(204,255,0,0.2);border:2px solid #CCFF00;border-radius:50%;color:#CCFF00;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.btn:active{background:rgba(204,255,0,0.5)}</style></head>
<body><div id="game"><div id="score">Score: 0</div><canvas id="c" width="240" height="400"></canvas>
<div id="controls"><button class="btn" ontouchstart="moveLeft()" onclick="moveLeft()">←</button>
<button class="btn" ontouchstart="rotate()" onclick="rotate()">↻</button>
<button class="btn" ontouchstart="moveRight()" onclick="moveRight()">→</button>
<button class="btn" ontouchstart="drop()" onclick="drop()">↓</button></div></div>
<script>const c=document.getElementById("c").getContext("2d"),W=10,H=20,B=24;let board=Array(H).fill().map(()=>Array(W).fill(0)),score=0,piece,px,py;
const shapes=[[[[1,1,1,1]],[[1],[1],[1],[1]]],[[[1,1],[1,1]]],[[[0,1,1],[1,1,0]],[[1,0],[1,1],[0,1]]],[[[1,1,0],[0,1,1]],[[0,1],[1,1],[1,0]]],[[[1,0,0],[1,1,1]],[[1,1],[1,0],[1,0]],[[1,1,1],[0,0,1]],[[0,1],[0,1],[1,1]]],[[[0,0,1],[1,1,1]],[[1,0],[1,0],[1,1]],[[1,1,1],[1,0,0]],[[1,1],[0,1],[0,1]]],[[[0,1,0],[1,1,1]],[[1,0],[1,1],[1,0]],[[1,1,1],[0,1,0]],[[0,1],[1,1],[0,1]]]];
const colors=["#00FFFF","#FFFF00","#00FF00","#FF0000","#0000FF","#FF7F00","#8B00FF"];let rot=0,si=0;
function newPiece(){si=Math.floor(Math.random()*shapes.length);rot=0;piece=shapes[si][rot];px=Math.floor((W-piece[0].length)/2);py=0;if(collision())gameOver()}
function collision(){for(let y=0;y<piece.length;y++)for(let x=0;x<piece[y].length;x++)if(piece[y][x]&&(board[py+y]===undefined||board[py+y][px+x]===undefined||board[py+y][px+x]))return true;return false}
function merge(){for(let y=0;y<piece.length;y++)for(let x=0;x<piece[y].length;x++)if(piece[y][x])board[py+y][px+x]=si+1}
function clearLines(){let lines=0;for(let y=H-1;y>=0;y--){if(board[y].every(c=>c)){board.splice(y,1);board.unshift(Array(W).fill(0));lines++;y++}}score+=lines*100;document.getElementById("score").textContent="Score: "+score}
function draw(){c.fillStyle="#0a0a0a";c.fillRect(0,0,W*B,H*B);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]){c.fillStyle=colors[board[y][x]-1];c.fillRect(x*B+1,y*B+1,B-2,B-2)}
for(let y=0;y<piece.length;y++)for(let x=0;x<piece[y].length;x++)if(piece[y][x]){c.fillStyle=colors[si];c.fillRect((px+x)*B+1,(py+y)*B+1,B-2,B-2)}}
function moveLeft(){px--;if(collision())px++}function moveRight(){px++;if(collision())px--}
function rotate(){const oldRot=rot;rot=(rot+1)%shapes[si].length;piece=shapes[si][rot];if(collision()){rot=oldRot;piece=shapes[si][rot]}}
function drop(){py++;if(collision()){py--;merge();clearLines();newPiece()}}
function gameOver(){alert("Game Over! Score: "+score);board=Array(H).fill().map(()=>Array(W).fill(0));score=0;document.getElementById("score").textContent="Score: 0";newPiece()}
function update(){drop();draw();setTimeout(update,500)}
document.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")moveLeft();if(e.key==="ArrowRight")moveRight();if(e.key==="ArrowUp")rotate();if(e.key==="ArrowDown")drop();draw()});
newPiece();draw();setTimeout(update,500);</script></body></html>'''

SPACE_DODGE_GAME = '''<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#050510;display:flex;justify-content:center;align-items:center;min-height:100vh;overflow:hidden;touch-action:none}
canvas{border-radius:8px;max-width:100vw;max-height:100vh}</style></head>
<body><canvas id="c"></canvas>
<script>const c=document.getElementById("c"),x=c.getContext("2d");c.width=400;c.height=600;
let ship={x:200,y:500,w:30,h:40},asteroids=[],score=0,gameOver=false,touch={x:200};
function spawnAsteroid(){asteroids.push({x:Math.random()*(c.width-40)+20,y:-40,r:Math.random()*20+15,s:Math.random()*3+2})}
function draw(){x.fillStyle="#050510";x.fillRect(0,0,c.width,c.height);
for(let i=0;i<50;i++){x.fillStyle="rgba(255,255,255,"+(Math.random()*0.5+0.2)+")";x.fillRect(Math.random()*c.width,Math.random()*c.height,1,1)}
x.fillStyle="#CCFF00";x.beginPath();x.moveTo(ship.x,ship.y-ship.h/2);x.lineTo(ship.x-ship.w/2,ship.y+ship.h/2);x.lineTo(ship.x+ship.w/2,ship.y+ship.h/2);x.closePath();x.fill();
x.shadowBlur=20;x.shadowColor="#CCFF00";x.fillStyle="#7000FF";
asteroids.forEach(a=>{x.beginPath();x.arc(a.x,a.y,a.r,0,Math.PI*2);x.fill()});x.shadowBlur=0;
x.fillStyle="#fff";x.font="bold 24px system-ui";x.fillText("Score: "+score,20,40);
if(gameOver){x.fillStyle="rgba(0,0,0,0.8)";x.fillRect(0,0,c.width,c.height);x.fillStyle="#CCFF00";x.font="bold 40px system-ui";x.textAlign="center";x.fillText("GAME OVER",c.width/2,c.height/2-20);x.font="24px system-ui";x.fillText("Score: "+score,c.width/2,c.height/2+20);x.fillText("Tap to restart",c.width/2,c.height/2+60)}}
function update(){if(gameOver)return;ship.x+=(touch.x-ship.x)*0.1;ship.x=Math.max(ship.w/2,Math.min(c.width-ship.w/2,ship.x));
asteroids.forEach(a=>{a.y+=a.s;const dx=ship.x-a.x,dy=ship.y-a.y;if(Math.sqrt(dx*dx+dy*dy)<a.r+15)gameOver=true});
asteroids=asteroids.filter(a=>a.y<c.height+50);if(Math.random()<0.03)spawnAsteroid();score++}
function loop(){update();draw();requestAnimationFrame(loop)}
c.addEventListener("touchmove",e=>{e.preventDefault();touch.x=e.touches[0].clientX-c.getBoundingClientRect().left});
c.addEventListener("mousemove",e=>{touch.x=e.clientX-c.getBoundingClientRect().left});
c.addEventListener("click",()=>{if(gameOver){asteroids=[];score=0;ship.x=200;gameOver=false}});
loop();</script></body></html>'''

COLOR_MATCH_GAME = '''<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui}
#score{color:#CCFF00;font-size:32px;font-weight:bold;margin-bottom:20px}#word{font-size:48px;font-weight:bold;margin-bottom:40px;text-transform:uppercase}
#buttons{display:grid;grid-template-columns:1fr 1fr;gap:15px;width:300px}
.btn{padding:25px;font-size:20px;font-weight:bold;border:none;border-radius:12px;cursor:pointer;text-transform:uppercase;transition:transform 0.1s}
.btn:active{transform:scale(0.95)}#timer{width:300px;height:8px;background:#222;border-radius:4px;margin-top:30px;overflow:hidden}
#bar{height:100%;background:#CCFF00;transition:width 0.1s linear}#msg{color:#fff;font-size:24px;margin-top:20px;min-height:30px}</style></head>
<body><div id="score">Score: 0</div><div id="word">RED</div><div id="buttons">
<button class="btn" style="background:#FF4444" onclick="check('red')">Red</button>
<button class="btn" style="background:#4444FF" onclick="check('blue')">Blue</button>
<button class="btn" style="background:#44FF44;color:#000" onclick="check('green')">Green</button>
<button class="btn" style="background:#FFFF44;color:#000" onclick="check('yellow')">Yellow</button></div>
<div id="timer"><div id="bar" style="width:100%"></div></div><div id="msg"></div>
<script>const colors=["red","blue","green","yellow"],names=["RED","BLUE","GREEN","YELLOW"],css=["#FF4444","#4444FF","#44FF44","#FFFF44"];
let score=0,timeLeft=100,correct,gameOver=false;
function newRound(){const wordIdx=Math.floor(Math.random()*4),colorIdx=Math.floor(Math.random()*4);
document.getElementById("word").textContent=names[wordIdx];document.getElementById("word").style.color=css[colorIdx];correct=colors[colorIdx]}
function check(c){if(gameOver)return;if(c===correct){score+=10;timeLeft=Math.min(100,timeLeft+10);document.getElementById("msg").textContent="✓ Correct!";document.getElementById("msg").style.color="#CCFF00"}
else{score=Math.max(0,score-5);timeLeft-=20;document.getElementById("msg").textContent="✗ Wrong!";document.getElementById("msg").style.color="#FF4444"}
document.getElementById("score").textContent="Score: "+score;if(timeLeft<=0){endGame()}else{newRound()}}
function endGame(){gameOver=true;document.getElementById("word").textContent="GAME OVER";document.getElementById("word").style.color="#fff";
document.getElementById("msg").textContent="Tap any button to restart"}
function tick(){if(gameOver)return;timeLeft-=1;document.getElementById("bar").style.width=timeLeft+"%";if(timeLeft<=0)endGame()}
function restart(){score=0;timeLeft=100;gameOver=false;document.getElementById("score").textContent="Score: 0";newRound()}
document.querySelectorAll(".btn").forEach(b=>b.addEventListener("click",()=>{if(gameOver)restart()}));
newRound();setInterval(tick,100);</script></body></html>'''

CYBER_RUNNER_GAME = '''<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#050510;display:flex;justify-content:center;align-items:center;min-height:100vh;overflow:hidden;touch-action:none}
canvas{border-radius:8px}</style></head>
<body><canvas id="c"></canvas>
<script>const c=document.getElementById("c"),x=c.getContext("2d");c.width=400;c.height=600;
let player={x:200,y:450,w:40,h:60,vy:0,grounded:true},obstacles=[],coins=[],score=0,speed=5,gameOver=false,jumping=false;
const ground=500,gravity=0.8,jumpForce=-15;
function spawnObstacle(){obstacles.push({x:c.width,y:ground-40,w:30,h:40})}
function spawnCoin(){coins.push({x:c.width,y:ground-100-Math.random()*100,r:15})}
function draw(){x.fillStyle="#050510";x.fillRect(0,0,c.width,c.height);
x.strokeStyle="#7000FF33";for(let i=0;i<20;i++){x.beginPath();x.moveTo(0,i*30+((Date.now()/20)%30));x.lineTo(c.width,i*30+((Date.now()/20)%30));x.stroke()}
for(let i=0;i<10;i++){x.beginPath();x.moveTo(i*40+((Date.now()/10)%40),0);x.lineTo(i*40+((Date.now()/10)%40),c.height);x.stroke()}
x.fillStyle="#7000FF";x.fillRect(0,ground,c.width,100);x.fillStyle="#CCFF00";
x.fillRect(player.x-player.w/2,player.y-player.h,player.w,player.h);x.fillStyle="#050510";
x.fillRect(player.x-10,player.y-player.h+15,8,8);x.fillRect(player.x+2,player.y-player.h+15,8,8);
x.fillStyle="#FF4444";obstacles.forEach(o=>{x.fillRect(o.x,o.y,o.w,o.h)});
x.fillStyle="#CCFF00";x.shadowBlur=15;x.shadowColor="#CCFF00";
coins.forEach(co=>{x.beginPath();x.arc(co.x,co.y,co.r,0,Math.PI*2);x.fill()});x.shadowBlur=0;
x.fillStyle="#fff";x.font="bold 24px system-ui";x.fillText("Score: "+score,20,40);
if(gameOver){x.fillStyle="rgba(0,0,0,0.8)";x.fillRect(0,0,c.width,c.height);x.fillStyle="#CCFF00";x.font="bold 40px system-ui";x.textAlign="center";
x.fillText("GAME OVER",c.width/2,c.height/2-20);x.font="24px system-ui";x.fillText("Score: "+score,c.width/2,c.height/2+20);x.fillText("Tap to restart",c.width/2,c.height/2+60)}}
function update(){if(gameOver)return;player.vy+=gravity;player.y+=player.vy;if(player.y>=ground){player.y=ground;player.vy=0;player.grounded=true}
obstacles.forEach(o=>{o.x-=speed;if(player.x+player.w/2>o.x&&player.x-player.w/2<o.x+o.w&&player.y>o.y&&player.y-player.h<o.y+o.h)gameOver=true});
coins.forEach((co,i)=>{co.x-=speed;const dx=player.x-co.x,dy=(player.y-player.h/2)-co.y;if(Math.sqrt(dx*dx+dy*dy)<co.r+20){coins.splice(i,1);score+=100}});
obstacles=obstacles.filter(o=>o.x>-50);coins=coins.filter(co=>co.x>-20);
if(Math.random()<0.02)spawnObstacle();if(Math.random()<0.03)spawnCoin();score++;speed=5+Math.floor(score/500)*0.5}
function jump(){if(player.grounded&&!gameOver){player.vy=jumpForce;player.grounded=false}}
function loop(){update();draw();requestAnimationFrame(loop)}
c.addEventListener("touchstart",e=>{e.preventDefault();if(gameOver){obstacles=[];coins=[];score=0;speed=5;player.y=ground;gameOver=false}else jump()});
c.addEventListener("click",()=>{if(gameOver){obstacles=[];coins=[];score=0;speed=5;player.y=ground;gameOver=false}else jump()});
document.addEventListener("keydown",e=>{if(e.code==="Space")jump()});
loop();</script></body></html>'''

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
