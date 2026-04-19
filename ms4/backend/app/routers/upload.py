import uuid
from fastapi import APIRouter, Depends, HTTPException
from botocore.exceptions import ClientError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import User, Video, WorkflowStatusLog
from ..queues import publish_processing_job
from ..responses import success_response
from ..schemas import CompleteUploadRequest, InitiateUploadRequest
from ..storage import generate_presigned_put_url, get_object_metadata
from ..utils import generate_object_key
from .helpers import ensure_subscription, increment_usage

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/initiate")
def initiate_upload(
    payload: InitiateUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = ensure_subscription(db, current_user.id)

    video_count = db.scalar(
        select(func.count(Video.id)).where(Video.user_id == current_user.id, Video.deleted_at.is_(None))
    ) or 0
    if video_count >= subscription.max_videos:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Video limit reached. Your {subscription.plan_name} plan allows "
                f"{subscription.max_videos} videos. Please upgrade your plan."
            ),
        )

    storage_used = db.scalar(
        select(func.coalesce(func.sum(Video.file_size), 0)).where(
            Video.user_id == current_user.id,
            Video.deleted_at.is_(None),
        )
    ) or 0

    if int(storage_used) + payload.fileSize > int(subscription.max_storage_bytes):
        raise HTTPException(status_code=403, detail="Storage quota exceeded for your current plan.")

    object_key = generate_object_key(current_user.id, payload.filename)
    upload_url = generate_presigned_put_url(object_key, payload.contentType, expires=900)

    return success_response(
        {
            "uploadUrl": upload_url,
            "objectKey": object_key,
            "expiresIn": 900,
            "bucket": settings.minio_bucket,
        },
        message="Upload URL generated.",
    )


@router.post("/complete")
def complete_upload(
    payload: CompleteUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        metadata = get_object_metadata(payload.objectKey)
    except ClientError as exc:
        raise HTTPException(
            status_code=404,
            detail="Upload verification failed. Object not found in storage.",
        ) from exc

    file_name = payload.objectKey.split("/")[-1] if "/" in payload.objectKey else payload.objectKey
    content_type = metadata.get("ContentType") or "video/mp4"
    file_size = int(metadata.get("ContentLength") or 0)

    video = Video(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        object_key=payload.objectKey,
        file_name=file_name,
        file_size=file_size,
        content_type=content_type,
        status="UPLOADED",
    )
    db.add(video)
    db.flush()

    increment_usage(db, current_user.id, file_size)

    db.add(
        WorkflowStatusLog(
            video_id=video.id,
            service_name="user-workflow-service",
            status="UPLOADED",
            message="Video uploaded successfully",
        )
    )

    video.status = "QUEUED"
    db.add(
        WorkflowStatusLog(
            video_id=video.id,
            service_name="user-workflow-service",
            status="QUEUED",
            message="Processing job queued",
        )
    )

    db.commit()

    publish_processing_job(
        {
            "job_id": str(uuid.uuid4()),
            "video_id": str(video.id),
            "user_id": str(current_user.id),
            "s3_raw_path": video.object_key,
            "original_filename": video.file_name,
            "content_type": video.content_type,
            "file_size_bytes": int(video.file_size),
        }
    )

    return success_response(
        {
            "videoId": video.id,
            "status": video.status,
            "message": "Video registered and processing started.",
        },
        message="Upload completed and workflow started.",
        status_code=201,
    )
