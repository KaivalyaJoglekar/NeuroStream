from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_ENV: str = "production"
    APP_PORT: int = 8085

    # Database — Render injects DATABASE_URL; MS5_DATABASE_URL takes priority
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./ms5_analytics.db",
    )

    # Analytics Config
    TIMESTAMP_BUCKET_SECONDS: int = 5
    MIN_REVISIT_COUNT: int = 2
    TOP_HIGHLIGHTS_COUNT: int = 5
    IMPORTANT_SECTIONS_COUNT: int = 10

    # Internal Auth (shared secret with MS4)
    INTERNAL_API_SECRET: str = "your_shared_internal_secret"

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        env_prefix="",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Returns cached settings singleton.

    Checks MS5_DATABASE_URL first to avoid Render's global DATABASE_URL collision.
    """
    overrides = {}
    ms5_url = os.environ.get("MS5_DATABASE_URL")
    if ms5_url:
        overrides["DATABASE_URL"] = ms5_url
    return Settings(**overrides)
