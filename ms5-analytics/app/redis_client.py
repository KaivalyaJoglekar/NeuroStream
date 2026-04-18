import logging
from typing import Optional

import redis.asyncio as redis
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_redis_pool: Optional[redis.Redis] = None


async def get_redis() -> Optional[redis.Redis]:
    """Returns the Redis client instance. Returns None if Redis is unavailable."""
    global _redis_pool
    if _redis_pool is None:
        return None
    try:
        await _redis_pool.ping()
        return _redis_pool
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return None


async def init_redis():
    """Initialize the Redis connection pool."""
    global _redis_pool
    try:
        _redis_pool = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        await _redis_pool.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.warning(f"Redis connection failed (service will run without cache): {e}")
        _redis_pool = None


async def close_redis():
    """Close the Redis connection pool."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Redis connection closed")
