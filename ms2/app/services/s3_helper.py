"""S3 download helper for fetching audio/frame artifacts before processing."""
from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig

from app.core.config import Settings

logger = logging.getLogger(__name__)

_s3_client = None


def _get_s3_client(settings: Settings):
    """Lazy-initialised S3 client (shared across calls)."""
    global _s3_client
    if _s3_client is None:
        extra_kwargs = {}
        endpoint_url = os.getenv("AWS_ENDPOINT_URL")
        if endpoint_url:
            extra_kwargs["endpoint_url"] = endpoint_url

        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            config=BotoConfig(signature_version="s3v4"),
            **extra_kwargs,
        )
    return _s3_client


def download_s3_file(
    settings: Settings,
    s3_key: str,
    dest_dir: Optional[str] = None,
) -> str:
    """Download a file from S3 to a local path and return that path.

    If *dest_dir* is ``None`` the system temp directory is used.
    The caller is responsible for cleaning up the file when done.
    """
    client = _get_s3_client(settings)
    bucket = settings.s3_bucket_name

    if not bucket:
        raise RuntimeError("S3 bucket name is not configured (S3_BUCKET_NAME / AWS_S3_BUCKET)")

    if dest_dir is None:
        dest_dir = tempfile.mkdtemp(prefix="ms2_")
    else:
        os.makedirs(dest_dir, exist_ok=True)

    filename = Path(s3_key).name
    local_path = os.path.join(dest_dir, filename)

    logger.info("Downloading s3://%s/%s → %s", bucket, s3_key, local_path)
    client.download_file(bucket, s3_key, local_path)
    return local_path
