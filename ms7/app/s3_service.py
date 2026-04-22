import uuid
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from app.config import settings


def _client():
    client_kwargs = {
        "service_name": "s3",
        "region_name": settings.aws_region,
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "config": Config(signature_version="s3v4"),
    }

    if settings.s3_endpoint_url:
        client_kwargs["endpoint_url"] = settings.s3_endpoint_url.rstrip("/")

    return boto3.client(
        **client_kwargs,
    )


def upload_pdf(pdf_bytes: bytes, prefix: str) -> tuple[str, str]:
    """
    Upload PDF bytes to S3 and return (presigned_url, s3_key).
    prefix is used as the folder name, e.g. 'chat', 'summary', 'research'.
    """
    key = f"{prefix}/{uuid.uuid4()}.pdf"
    client = _client()

    client.put_object(
        Bucket=settings.s3_export_bucket,
        Key=key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )

    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_export_bucket, "Key": key},
        ExpiresIn=settings.presigned_url_expiry,
    )

    return url, key
