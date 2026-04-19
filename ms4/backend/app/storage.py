import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from .config import settings


def _resolve_endpoint() -> tuple[str, bool]:
    endpoint = settings.b2_endpoint.strip().rstrip("/")
    if endpoint.startswith("https://"):
        return endpoint, True
    if endpoint.startswith("http://"):
        return endpoint, False

    endpoint_protocol = "https" if settings.b2_use_ssl else "http"
    return f"{endpoint_protocol}://{endpoint}:{settings.b2_port}", settings.b2_use_ssl


_endpoint_url, _use_ssl = _resolve_endpoint()

s3_client = boto3.client(
    "s3",
    endpoint_url=_endpoint_url,
    aws_access_key_id=settings.b2_key_id,
    aws_secret_access_key=settings.b2_application_key,
    region_name=settings.b2_region,
    use_ssl=_use_ssl,
    verify=_use_ssl,
    config=Config(signature_version="s3v4"),
)


def ensure_bucket() -> None:
    try:
        s3_client.head_bucket(Bucket=settings.b2_bucket)
    except ClientError as exc:
        # Keep local MinIO developer flow convenient, but require pre-created bucket for remote providers.
        if settings.b2_endpoint in {"localhost", "127.0.0.1"}:
            s3_client.create_bucket(Bucket=settings.b2_bucket)
            return

        raise RuntimeError(
            f"Storage bucket '{settings.b2_bucket}' is not accessible. "
            "For Backblaze B2, create the bucket first and verify B2 credentials/endpoints."
        ) from exc


def generate_presigned_put_url(object_key: str, content_type: str, expires: int = 900) -> str:
    return s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.b2_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def get_object_metadata(object_key: str) -> dict:
    return s3_client.head_object(Bucket=settings.b2_bucket, Key=object_key)


def generate_presigned_get_url(object_key: str, expires: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.b2_bucket,
            "Key": object_key,
        },
        ExpiresIn=expires,
    )


def delete_object(object_key: str) -> None:
    s3_client.delete_object(Bucket=settings.b2_bucket, Key=object_key)
