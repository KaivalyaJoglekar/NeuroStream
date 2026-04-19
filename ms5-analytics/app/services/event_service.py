import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import UserVideoEvent
from app.models.schemas import UserEventRequest

logger = logging.getLogger(__name__)


async def record_event(db: AsyncSession, event_req: UserEventRequest) -> str:
    """Records a user interaction event to the database.

    Returns the event ID as a string.
    """
    db_event = UserVideoEvent(
        user_id=event_req.user_id,
        video_id=event_req.video_id,
        event_type=event_req.event_type.value,
        timestamp_sec=event_req.timestamp_sec,
        query_text=event_req.query_text,
        session_id=event_req.session_id,
    )

    db.add(db_event)
    await db.flush()

    event_id = str(db_event.id)
    logger.info(
        f"Recorded event {event_id}: {event_req.event_type.value} "
        f"user={event_req.user_id} video={event_req.video_id} "
        f"ts={event_req.timestamp_sec}"
    )

    return event_id
