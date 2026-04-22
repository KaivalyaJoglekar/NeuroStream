from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    port: int = Field(default=4000, alias="PORT")
    node_env: str = Field(default="development", alias="NODE_ENV")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    s3_endpoint: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_ENDPOINT_URL", "S3_ENDPOINT", "B2_ENDPOINT", "MINIO_ENDPOINT"),
    )
    s3_port: int = Field(default=443, validation_alias=AliasChoices("S3_PORT", "B2_PORT", "MINIO_PORT"))
    s3_use_ssl: bool = Field(default=True, validation_alias=AliasChoices("S3_USE_SSL", "B2_USE_SSL", "MINIO_USE_SSL"))
    s3_access_key_id: str = Field(
        validation_alias=AliasChoices("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "B2_KEY_ID", "MINIO_ACCESS_KEY")
    )
    s3_secret_access_key: str = Field(
        validation_alias=AliasChoices(
            "S3_SECRET_ACCESS_KEY",
            "AWS_SECRET_ACCESS_KEY",
            "B2_APPLICATION_KEY",
            "MINIO_SECRET_KEY",
        )
    )
    s3_bucket: str = Field(
        default="neurostream-videos",
        validation_alias=AliasChoices("AWS_S3_BUCKET", "S3_BUCKET_NAME", "B2_BUCKET", "MINIO_BUCKET"),
    )
    s3_region: str = Field(default="us-east-1", validation_alias=AliasChoices("S3_REGION", "AWS_REGION", "B2_REGION"))

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_expires_in: str = Field(default="7d", alias="JWT_EXPIRES_IN")

    internal_api_key: str = Field(alias="INTERNAL_API_KEY")
    ms2_base_url: str = Field(default="https://neurostream-1.onrender.com", alias="MS2_BASE_URL")
    ms5_base_url: str = Field(default="https://neurostreamms5.onrender.com", alias="MS5_BASE_URL")
    ms5_internal_secret: str = Field(default="", alias="MS5_INTERNAL_SECRET")

    cors_origin: str = Field(default="*", alias="CORS_ORIGIN")


settings = Settings()
