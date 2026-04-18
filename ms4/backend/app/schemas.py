from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .constants import KNOWN_SERVICES, VIDEO_STATUSES


class BaseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class RegisterRequest(BaseSchema):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class InitiateUploadRequest(BaseSchema):
    filename: str = Field(min_length=1, max_length=255)
    contentType: str = Field(min_length=3, max_length=100)
    fileSize: int = Field(gt=0)
    title: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=1500)


class CompleteUploadRequest(BaseSchema):
    objectKey: str = Field(min_length=3, max_length=1024)
    title: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=1500)
    metadata: dict[str, str] | None = None


class RenameVideoRequest(BaseSchema):
    title: str = Field(min_length=1, max_length=180)


class StatusCallbackRequest(BaseSchema):
    videoId: str
    serviceName: Literal[
        "media-processor",
        "ai-vision-nlp",
        "search-discovery",
        "video-analytics",
        "agentic-researcher",
    ]
    newStatus: Literal[
        "PENDING",
        "UPLOADING",
        "UPLOADED",
        "QUEUED",
        "PROCESSING",
        "MEDIA_PROCESSED",
        "AI_PROCESSED",
        "INDEXED",
        "ANALYTICS_READY",
        "COMPLETED",
        "FAILED",
        "DELETED",
    ]
    message: str | None = Field(default=None, max_length=500)
    metadata: dict[str, Any] | None = None
    processedMinutes: float | None = Field(default=None, gt=0)


def ensure_valid_video_status(status: str | None) -> str | None:
    if status is None:
        return None
    if status not in VIDEO_STATUSES:
        raise ValueError("Invalid status value.")
    return status


def ensure_valid_service_name(service_name: str) -> str:
    if service_name not in KNOWN_SERVICES:
        raise ValueError("Unknown serviceName.")
    return service_name
