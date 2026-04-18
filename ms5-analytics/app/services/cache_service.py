import json
import logging
from typing import Optional

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class CacheService:
    """Redis cache service for analytics results with graceful degradation."""

    def __init__(self, redis_client: Optional[redis.Redis], ttl_seconds: int = 300):
        self.redis = redis_client
        self.ttl = ttl_seconds

    async def get_analytics(self, user_id: str, video_id: str) -> Optional[dict]:
        """Get cached analytics result. Returns None on miss or Redis unavailability."""
        if not self.redis:
            return None
        try:
            key = f"analytics:{user_id}:{video_id}"
            data = await self.redis.get(key)
            if data:
                logger.debug(f"Cache HIT for {key}")
                return json.loads(data)
            logger.debug(f"Cache MISS for {key}")
            return None
        except Exception as e:
            logger.warning(f"Redis cache read failed: {e}")
            return None

    async def set_analytics(self, user_id: str, video_id: str, data: dict) -> None:
        """Cache analytics result with TTL."""
        if not self.redis:
            return
        try:
            key = f"analytics:{user_id}:{video_id}"
            await self.redis.set(key, json.dumps(data, default=str), ex=self.ttl)
            logger.debug(f"Cached analytics for {key} (TTL={self.ttl}s)")
        except Exception as e:
            logger.warning(f"Redis cache write failed: {e}")

    async def invalidate_analytics(self, user_id: str, video_id: str) -> None:
        """Invalidate cached analytics for a user-video pair."""
        if not self.redis:
            return
        try:
            key = f"analytics:{user_id}:{video_id}"
            await self.redis.delete(key)
            logger.debug(f"Invalidated cache for {key}")
        except Exception as e:
            logger.warning(f"Redis cache invalidation failed: {e}")

    async def increment_bucket_score(
        self, user_id: str, video_id: str, bucket_ts: int, weight: float
    ) -> None:
        """Increment real-time bucket score counter in Redis."""
        if not self.redis:
            return
        try:
            key = f"bucket_score:{user_id}:{video_id}:{bucket_ts}"
            await self.redis.incrbyfloat(key, weight)
            await self.redis.expire(key, 86400)  # 24h TTL
        except Exception as e:
            logger.warning(f"Redis bucket score increment failed: {e}")

    async def append_recent_event(
        self, user_id: str, video_id: str, event_data: dict
    ) -> None:
        """Append event to the recent events list (capped at 100)."""
        if not self.redis:
            return
        try:
            key = f"events:{user_id}:{video_id}"
            await self.redis.lpush(key, json.dumps(event_data, default=str))
            await self.redis.ltrim(key, 0, 99)  # Keep only last 100
            await self.redis.expire(key, 86400)  # 24h TTL
        except Exception as e:
            logger.warning(f"Redis event append failed: {e}")
