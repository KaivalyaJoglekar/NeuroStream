import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.schemas import UserEventRequest, UserEventResponse, EventType
from app.services.event_service import record_event

logger = logging.getLogger(__name__)

settings = get_settings()

router = APIRouter(prefix="/api/v1", tags=["events"])


@router.post(
    "/events",
    response_model=UserEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_event(
    event: UserEventRequest,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Ingest a user interaction event from MS4."""
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing internal API secret",
        )

    if event.timestamp_sec is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"timestamp_sec is required for {event.event_type.value} events",
        )

    if event.event_type == EventType.SEARCH and not event.query_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="query_text is required for SEARCH events",
        )

    event_id = await record_event(db, event)

    return UserEventResponse(event_id=event_id)
