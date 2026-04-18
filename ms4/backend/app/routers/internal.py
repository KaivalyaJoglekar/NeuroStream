from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..constants import VIDEO_STATUSES
from ..database import get_db
from ..deps import verify_internal_api_key
from ..models import CallbackEvent, Video, WorkflowStatusLog
from ..responses import success_response
from ..schemas import StatusCallbackRequest
from ..utils import utc_now
from .helpers import add_processed_minutes

router = APIRouter(prefix="/internal", tags=["internal"])


@router.patch("/job-status", dependencies=[Depends(verify_internal_api_key)])
def update_status(
    payload: StatusCallbackRequest,
    db: Session = Depends(get_db),
):
    if payload.newStatus not in VIDEO_STATUSES:
        raise HTTPException(status_code=422, detail="Validation failed: body.newStatus: Invalid enum value")

    video = db.scalar(select(Video).where(Video.id == payload.videoId, Video.deleted_at.is_(None)))
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or already deleted.")

    video.status = payload.newStatus
    video.updated_at = utc_now()

    db.add(
        CallbackEvent(
            video_id=video.id,
            service_name=payload.serviceName,
            event_type=payload.newStatus,
            payload=payload.metadata,
        )
    )

    db.add(
        WorkflowStatusLog(
            video_id=video.id,
            service_name=payload.serviceName,
            status=payload.newStatus,
            message=payload.message,
        )
    )

    if payload.processedMinutes:
        add_processed_minutes(db, video.user_id, payload.processedMinutes)

    db.commit()

    return success_response(
        {
            "videoId": video.id,
            "status": video.status,
            "acknowledged": True,
        },
        message="Callback acknowledged.",
    )
