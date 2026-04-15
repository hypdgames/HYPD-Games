"""
Redis Caching Module for Hypd Games
Provides caching for game feed and analytics
"""

import os
import json
import logging
from typing import Optional, Any
from datetime import timedelta

logger = logging.getLogger(__name__)

# Redis client (will be initialized if REDIS_URL is set)
redis_client = None

REDIS_URL = os.environ.get('REDIS_URL')

if REDIS_URL:
    try:
        import redis
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info("Redis client initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis: {e}")
        redis_client = None


# Cache key prefixes
CACHE_KEYS = {
    "games_feed": "hypd:games:feed",
    "game": "hypd:game:",
    "categories": "hypd:categories",
    "user_profile": "hypd:user:",
    "analytics_daily": "hypd:analytics:daily:",
    "challenges_active": "hypd:challenges:active",
}

# Default TTLs (in seconds)
CACHE_TTLS = {
    "games_feed": 60,  # 1 minute
    "game": 300,  # 5 minutes
    "categories": 3600,  # 1 hour
    "user_profile": 300,  # 5 minutes
    "analytics": 300,  # 5 minutes
    "challenges": 60,  # 1 minute
}


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    if not redis_client:
        return None
    
    try:
        value = redis_client.get(key)
        if value:
            return json.loads(value)
    except Exception as e:
        logger.error(f"Cache get error for {key}: {e}")
    
    return None


def set_cache(key: str, value: Any, ttl: int = 60) -> bool:
    """Set value in cache with TTL"""
    if not redis_client:
        return False
    
    try:
        redis_client.setex(key, ttl, json.dumps(value))
        return True
    except Exception as e:
        logger.error(f"Cache set error for {key}: {e}")
        return False


def delete_cache(key: str) -> bool:
    """Delete value from cache"""
    if not redis_client:
        return False
    
    try:
        redis_client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Cache delete error for {key}: {e}")
        return False


def delete_pattern(pattern: str) -> int:
    """Delete all keys matching pattern"""
    if not redis_client:
        return 0
    
    try:
        keys = redis_client.keys(pattern)
        if keys:
            return redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Cache delete pattern error for {pattern}: {e}")
    
    return 0


# Convenience functions for specific cache types

def get_games_feed(category: Optional[str] = None) -> Optional[list]:
    """Get cached games feed"""
    key = f"{CACHE_KEYS['games_feed']}:{category or 'all'}"
    return get_cache(key)


def set_games_feed(games: list, category: Optional[str] = None) -> bool:
    """Cache games feed"""
    key = f"{CACHE_KEYS['games_feed']}:{category or 'all'}"
    return set_cache(key, games, CACHE_TTLS["games_feed"])


def invalidate_games_cache() -> int:
    """Invalidate all games-related cache"""
    return delete_pattern("hypd:games:*")


def is_redis_available() -> bool:
    """Check if Redis is available"""
    if not redis_client:
        return False
    try:
        redis_client.ping()
        return True
    except Exception:
        return False
