import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from .config import settings

_endpoint_protocol = "https" if settings.minio_use_ssl else "http"
_endpoint_url = f"{_endpoint_protocol}://{settings.minio_endpoint}:{settings.minio_port}"

s3_client = boto3.client(
    "s3",
    endpoint_url=_endpoint_url,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    region_name="us-east-1",
    use_ssl=settings.minio_use_ssl,
    verify=settings.minio_use_ssl,
    config=Config(signature_version="s3v4"),
)


def ensure_bucket() -> None:
    try:
        s3_client.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        s3_client.create_bucket(Bucket=settings.minio_bucket)


def generate_presigned_put_url(object_key: str, content_type: str, expires: int = 900) -> str:
    return s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.minio_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def get_object_metadata(object_key: str) -> dict:
    return s3_client.head_object(Bucket=settings.minio_bucket, Key=object_key)


def generate_presigned_get_url(object_key: str, expires: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.minio_bucket,
            "Key": object_key,
        },
        ExpiresIn=expires,
    )


def delete_object(object_key: str) -> None:
    s3_client.delete_object(Bucket=settings.minio_bucket, Key=object_key)
