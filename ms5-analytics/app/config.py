from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field
from functools import lru_cache
import os


def _resolve_database_url() -> str:
    """Resolve database URL with MS5-specific override to avoid
    collisions with Render's global DATABASE_URL (which points to PostgreSQL).

    Priority: MS5_DATABASE_URL → DATABASE_URL → SQLite default.
    Automatically converts plain 'postgresql://' to 'postgresql+asyncpg://'
    since SQLAlchemy's async engine requires the asyncpg driver prefix.
    """
    url = os.environ.get("MS5_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        # Render injects postgresql:// which defaults to psycopg2 (sync).
        # Convert to the async driver prefix for create_async_engine.
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    return "sqlite+aiosqlite:///./ms5_analytics.db"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_ENV: str = "development"
    APP_PORT: int = 8085

    # Database — uses MS5_DATABASE_URL to avoid Render's global DATABASE_URL
    DATABASE_URL: str = Field(default_factory=_resolve_database_url)

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
        env_prefix="",
    )


@lru_cache()
def get_settings() -> Settings:
    """Returns cached settings singleton."""
    return Settings()

