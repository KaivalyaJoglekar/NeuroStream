from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    port: int = Field(default=4000, alias="PORT")
    node_env: str = Field(default="development", alias="NODE_ENV")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    minio_endpoint: str = Field(default="localhost", alias="MINIO_ENDPOINT")
    minio_port: int = Field(default=9000, alias="MINIO_PORT")
    minio_use_ssl: bool = Field(default=False, alias="MINIO_USE_SSL")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="neurostream-videos", alias="MINIO_BUCKET")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_expires_in: str = Field(default="7d", alias="JWT_EXPIRES_IN")

    internal_api_key: str = Field(alias="INTERNAL_API_KEY")

    cors_origin: str = Field(default="http://localhost:3000", alias="CORS_ORIGIN")


settings = Settings()
