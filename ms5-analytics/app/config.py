from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_ENV: str = "development"
    APP_PORT: int = 8085

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/neurostream_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/1"

    # Analytics Config
    TIMESTAMP_BUCKET_SECONDS: int = 5
    MIN_REVISIT_COUNT: int = 2
    TOP_HIGHLIGHTS_COUNT: int = 5
    IMPORTANT_SECTIONS_COUNT: int = 10
    CACHE_TTL_SECONDS: int = 300

    # Internal Auth
    INTERNAL_API_SECRET: str = "your_shared_internal_secret"

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """Returns cached settings singleton."""
    return Settings()
