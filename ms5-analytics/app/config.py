from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_ENV: str = "development"
    APP_PORT: int = 8085

    # Database — defaults to local SQLite so the service deploys anywhere
    # Set DATABASE_URL to a postgresql+asyncpg://... string for production
    DATABASE_URL: str = "sqlite+aiosqlite:///./ms5_analytics.db"

    # Analytics Config
    TIMESTAMP_BUCKET_SECONDS: int = 5
    MIN_REVISIT_COUNT: int = 2
    TOP_HIGHLIGHTS_COUNT: int = 5
    IMPORTANT_SECTIONS_COUNT: int = 10

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
