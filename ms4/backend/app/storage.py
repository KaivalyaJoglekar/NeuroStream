import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from urllib.parse import urlparse

from .config import settings


def _resolve_endpoint() -> tuple[str, bool]:
    endpoint = settings.s3_endpoint.strip().rstrip("/")
    if endpoint == "":
        return "", settings.s3_use_ssl
    if endpoint.startswith("https://"):
        return endpoint, True
    if endpoint.startswith("http://"):
        return endpoint, False

    endpoint_protocol = "https" if settings.s3_use_ssl else "http"
    return f"{endpoint_protocol}://{endpoint}:{settings.s3_port}", settings.s3_use_ssl


_endpoint_url, _use_ssl = _resolve_endpoint()

_client_kwargs = {
    "service_name": "s3",
    "aws_access_key_id": settings.s3_access_key_id,
    "aws_secret_access_key": settings.s3_secret_access_key,
    "region_name": settings.s3_region,
    "use_ssl": _use_ssl,
    "verify": _use_ssl,
    "config": Config(signature_version="s3v4"),
}

if _endpoint_url:
    _client_kwargs["endpoint_url"] = _endpoint_url

s3_client = boto3.client(**_client_kwargs)


def _is_local_endpoint() -> bool:
    if not settings.s3_endpoint:
        return False

    endpoint = settings.s3_endpoint.strip().rstrip("/")
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        host = parsed.hostname or ""
    else:
        host = endpoint.split(":", 1)[0]

    return host in {"localhost", "127.0.0.1"}


def ensure_bucket() -> None:
    try:
        s3_client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError as exc:
        # Keep local MinIO developer flow convenient, but require pre-created bucket for remote providers.
        if _is_local_endpoint():
            s3_client.create_bucket(Bucket=settings.s3_bucket)
            return

        raise RuntimeError(
            f"Storage bucket '{settings.s3_bucket}' is not accessible. "
            "Create the bucket first and verify S3 credentials/endpoints."
        ) from exc


def generate_presigned_put_url(object_key: str, content_type: str, expires: int = 900) -> str:
    return s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def get_object_metadata(object_key: str) -> dict:
    return s3_client.head_object(Bucket=settings.s3_bucket, Key=object_key)


def generate_presigned_get_url(object_key: str, expires: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
        },
        ExpiresIn=expires,
    )


def delete_object(object_key: str) -> None:
    s3_client.delete_object(Bucket=settings.s3_bucket, Key=object_key)
