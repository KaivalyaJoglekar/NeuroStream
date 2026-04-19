import json
import logging
from urllib import error, request

from .config import settings


logger = logging.getLogger(__name__)


def forward_event_to_ms5(
    *,
    user_id: str,
    video_id: str,
    event_type: str,
    timestamp_sec: float,
    query_text: str | None = None,
    session_id: str | None = None,
) -> bool:
    base_url = settings.ms5_base_url.rstrip("/")
    if not base_url:
        return False

    payload = {
        "user_id": user_id,
        "video_id": video_id,
        "event_type": event_type,
        "timestamp_sec": timestamp_sec,
        "query_text": query_text,
        "session_id": session_id,
    }

    secret = settings.ms5_internal_secret or settings.internal_api_key
    headers = {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
    }

    req = request.Request(
        f"{base_url}/api/v1/events",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=5) as response:
            return 200 <= response.status < 300
    except error.HTTPError as exc:
        logger.warning("MS5 event forwarding rejected (%s): %s", exc.code, exc.reason)
        return False
    except Exception as exc:
        logger.warning("MS5 event forwarding failed: %s", exc)
        return False
