from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import BillingUsage, User, Video
from ..responses import success_response
from ..utils import get_current_month
from .helpers import ensure_subscription

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/summary")
def billing_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = ensure_subscription(db, current_user.id)

    month = get_current_month()
    usage = db.scalar(
        select(BillingUsage).where(BillingUsage.user_id == current_user.id, BillingUsage.month == month)
    )

    current_storage = db.scalar(
        select(func.coalesce(func.sum(Video.file_size), 0)).where(
            Video.user_id == current_user.id,
            Video.deleted_at.is_(None),
        )
    ) or 0

    current_video_count = db.scalar(
        select(func.count(Video.id)).where(
            Video.user_id == current_user.id,
            Video.deleted_at.is_(None),
        )
    ) or 0

    videos_uploaded = int(current_video_count)
    storage_used = int(current_storage)
    minutes_processed = float(usage.minutes_processed) if usage else 0.0

    remaining_storage = int(subscription.max_storage_bytes) - storage_used

    return success_response(
        {
            "plan": {
                "name": subscription.plan_name,
                "maxVideos": subscription.max_videos,
                "maxStorageBytes": str(subscription.max_storage_bytes),
                "maxMinutes": subscription.max_minutes,
                "expiresAt": subscription.expires_at.isoformat() if subscription.expires_at else None,
            },
            "usage": {
                "month": usage.month if usage else month,
                "videosUploaded": videos_uploaded,
                "storageUsedBytes": str(storage_used),
                "minutesProcessed": minutes_processed,
            },
            "remaining": {
                "videos": max(subscription.max_videos - videos_uploaded, 0),
                "storageBytes": str(max(remaining_storage, 0)),
                "minutes": max(subscription.max_minutes - minutes_processed, 0),
            },
        }
    )
