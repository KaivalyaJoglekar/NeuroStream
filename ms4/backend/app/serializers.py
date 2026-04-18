from .models import User, Video, WorkflowStatusLog


def serialize_user(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_video(video: Video):
    return {
        "id": video.id,
        "title": video.title,
        "description": video.description,
        "objectKey": video.object_key,
        "fileName": video.file_name,
        "fileSize": str(video.file_size),
        "contentType": video.content_type,
        "status": video.status,
        "duration": video.duration,
        "thumbnailKey": video.thumbnail_key,
        "createdAt": video.created_at.isoformat() if video.created_at else None,
        "updatedAt": video.updated_at.isoformat() if video.updated_at else None,
        "deletedAt": video.deleted_at.isoformat() if video.deleted_at else None,
    }


def serialize_workflow_log(log: WorkflowStatusLog):
    return {
        "id": log.id,
        "serviceName": log.service_name,
        "status": log.status,
        "message": log.message,
        "createdAt": log.created_at.isoformat() if log.created_at else None,
    }
