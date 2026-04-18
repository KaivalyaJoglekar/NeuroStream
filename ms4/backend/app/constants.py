VIDEO_STATUSES = {
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
}

USER_ROLES = {"USER", "ADMIN"}
PLAN_NAMES = {"FREE", "PRO", "ENTERPRISE"}

KNOWN_SERVICES = {
    "media-processor",
    "ai-vision-nlp",
    "search-discovery",
    "video-analytics",
    "agentic-researcher",
}

WORKFLOW_QUEUE_NAME = "workflow-jobs"
CLEANUP_QUEUE_NAME = "cleanup-jobs"
