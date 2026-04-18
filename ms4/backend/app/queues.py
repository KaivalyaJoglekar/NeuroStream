import json

import redis

from .config import settings
from .constants import CLEANUP_QUEUE_NAME, WORKFLOW_QUEUE_NAME

redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def publish_processing_job(payload: dict) -> None:
    redis_client.lpush(WORKFLOW_QUEUE_NAME, json.dumps(payload))


def publish_cleanup_job(payload: dict) -> None:
    redis_client.lpush(CLEANUP_QUEUE_NAME, json.dumps(payload))
