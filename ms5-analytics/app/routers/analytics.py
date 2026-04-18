import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.redis_client import get_redis
from app.models.schemas import (
    AnalyticsResponse,
    HighlightsResponse,
    QueryHistoryResponse,
    RecomputeResponse,
)
from app.services.analytics_service import get_analytics, recompute_analytics
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)

settings = get_settings()

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _validate_secret(x_internal_secret: str = Header(None, alias="X-Internal-Secret")):
    """Validate the internal API secret header."""
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing internal API secret",
        )


@router.get(
    "/{user_id}/{video_id}",
    response_model=AnalyticsResponse,
)
async def get_user_video_analytics(
    user_id: str,
    video_id: str,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Returns the full analytics summary for a user-video pair.

    Checks Redis cache first, computes on miss.
    """
    _validate_secret(x_internal_secret)

    redis_client = await get_redis()
    cache = CacheService(redis_client, settings.CACHE_TTL_SECONDS)

    analytics = await get_analytics(db, user_id, video_id, cache)
    return analytics


@router.get(
    "/{user_id}/{video_id}/highlights",
    response_model=HighlightsResponse,
)
async def get_user_video_highlights(
    user_id: str,
    video_id: str,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Returns only the smart highlights for a user-video pair.

    Lightweight endpoint for frontend player overlay.
    """
    _validate_secret(x_internal_secret)

    redis_client = await get_redis()
    cache = CacheService(redis_client, settings.CACHE_TTL_SECONDS)

    analytics = await get_analytics(db, user_id, video_id, cache)
    return HighlightsResponse(
        video_id=video_id,
        highlights=analytics.smart_highlights,
    )


@router.get(
    "/{user_id}/{video_id}/queries",
    response_model=QueryHistoryResponse,
)
async def get_user_video_queries(
    user_id: str,
    video_id: str,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Returns the full query history for a user on a specific video."""
    _validate_secret(x_internal_secret)

    redis_client = await get_redis()
    cache = CacheService(redis_client, settings.CACHE_TTL_SECONDS)

    analytics = await get_analytics(db, user_id, video_id, cache)
    return QueryHistoryResponse(
        video_id=video_id,
        query_history=analytics.query_history,
    )


@router.post(
    "/{user_id}/{video_id}/recompute",
    response_model=RecomputeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def force_recompute(
    user_id: str,
    video_id: str,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Force-recomputes analytics for a user-video pair.

    Invalidates Redis cache and recomputes from PostgreSQL.
    """
    _validate_secret(x_internal_secret)

    redis_client = await get_redis()
    cache = CacheService(redis_client, settings.CACHE_TTL_SECONDS)

    await recompute_analytics(db, user_id, video_id, cache)

    return RecomputeResponse(
        status="recompute_triggered",
        video_id=video_id,
    )
