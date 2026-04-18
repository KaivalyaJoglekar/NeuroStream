import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import UserVideoEvent
from app.models.schemas import UserEventRequest, EventType
from app.services.cache_service import CacheService
from app.utils.time_utils import bucket_timestamp
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Signal weights for bucket scoring
SIGNAL_WEIGHTS = {
    "SEARCH": 5.0,
    "REPLAY": 3.0,
    "SEEK": 1.5,
    "PAUSE": 1.0,
    "PLAY": 0.0,
}


async def record_event(
    db: AsyncSession,
    event_req: UserEventRequest,
    cache: CacheService,
) -> str:
    """Records a user interaction event to PostgreSQL and updates Redis counters.

    Returns the event ID as a string.
    """
    # Create the database record
    db_event = UserVideoEvent(
        user_id=event_req.user_id,
        video_id=event_req.video_id,
        event_type=event_req.event_type.value,
        timestamp_sec=event_req.timestamp_sec,
        query_text=event_req.query_text,
        session_id=event_req.session_id,
    )

    db.add(db_event)
    await db.flush()  # Flush to get the generated ID

    event_id = str(db_event.id)
    logger.info(
        f"Recorded event {event_id}: {event_req.event_type.value} "
        f"user={event_req.user_id} video={event_req.video_id} "
        f"ts={event_req.timestamp_sec}"
    )

    # Update Redis counters (non-blocking, best-effort)
    if event_req.timestamp_sec is not None:
        bucket_ts = bucket_timestamp(
            event_req.timestamp_sec, settings.TIMESTAMP_BUCKET_SECONDS
        )
        weight = SIGNAL_WEIGHTS.get(event_req.event_type.value, 0.0)
        if weight > 0:
            await cache.increment_bucket_score(
                event_req.user_id, event_req.video_id, bucket_ts, weight
            )

    # Append to recent events list in Redis
    event_data = {
        "event_id": event_id,
        "event_type": event_req.event_type.value,
        "timestamp_sec": event_req.timestamp_sec,
        "query_text": event_req.query_text,
        "session_id": event_req.session_id,
    }
    await cache.append_recent_event(
        event_req.user_id, event_req.video_id, event_data
    )

    return event_id
