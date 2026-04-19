from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    aws_access_key_id: str = Field(validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID"))
    aws_secret_access_key: str = Field(
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY")
    )
    aws_region: str = Field(default="us-east-1", validation_alias=AliasChoices("AWS_REGION", "S3_REGION"))
    s3_export_bucket: str = Field(
        default="neurostream-exports",
        validation_alias=AliasChoices("S3_EXPORT_BUCKET", "AWS_S3_BUCKET"),
    )
    presigned_url_expiry: int = 3600
    rabbitmq_host: str = "localhost"
    rabbitmq_user: str = "guest"
    rabbitmq_pass: str = "guest"
    enable_rabbitmq_consumer: bool = False
    port: int = 8007

    class Config:
        env_file = ".env"


settings = Settings()
