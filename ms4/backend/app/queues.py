import json
import logging

import redis

from .config import settings
from .constants import CLEANUP_QUEUE_NAME, WORKFLOW_QUEUE_NAME

redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
logger = logging.getLogger(__name__)


def publish_processing_job(payload: dict) -> bool:
    try:
        redis_client.lpush(WORKFLOW_QUEUE_NAME, json.dumps(payload))
        return True
    except Exception as exc:
        logger.error("Failed to enqueue processing job: %s", exc)
        return False


def publish_cleanup_job(payload: dict) -> None:
    redis_client.lpush(CLEANUP_QUEUE_NAME, json.dumps(payload))
