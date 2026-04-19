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

    b2_endpoint: str = Field(default="localhost", validation_alias=AliasChoices("B2_ENDPOINT", "MINIO_ENDPOINT"))
    b2_port: int = Field(default=9000, validation_alias=AliasChoices("B2_PORT", "MINIO_PORT"))
    b2_use_ssl: bool = Field(default=False, validation_alias=AliasChoices("B2_USE_SSL", "MINIO_USE_SSL"))
    b2_key_id: str = Field(validation_alias=AliasChoices("B2_KEY_ID", "MINIO_ACCESS_KEY"))
    b2_application_key: str = Field(validation_alias=AliasChoices("B2_APPLICATION_KEY", "MINIO_SECRET_KEY"))
    b2_bucket: str = Field(default="neurostream-videos", validation_alias=AliasChoices("B2_BUCKET", "MINIO_BUCKET"))
    b2_region: str = Field(default="us-west-004", validation_alias=AliasChoices("B2_REGION"))

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_expires_in: str = Field(default="7d", alias="JWT_EXPIRES_IN")

    internal_api_key: str = Field(alias="INTERNAL_API_KEY")
    ms2_base_url: str = Field(default="http://ms2-service:8000", alias="MS2_BASE_URL")
    ms5_base_url: str = Field(default="http://localhost:8085", alias="MS5_BASE_URL")
    ms5_internal_secret: str = Field(default="", alias="MS5_INTERNAL_SECRET")

    cors_origin: str = Field(default="http://localhost:3000", alias="CORS_ORIGIN")


settings = Settings()
