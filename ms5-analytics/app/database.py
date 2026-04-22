"""
Database module — lazy initialization for deployment safety.

The engine is NOT created at import time. Instead, init_db() must be called
during app startup (lifespan). This avoids import-time crashes from bad
DATABASE_URL values on Render or other PaaS platforms.
"""
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# These are set by init_db() at startup
_engine = None
_async_session_factory = None


def _fix_db_url(url: str) -> str:
    """Convert Render/Heroku-style postgres:// URLs to asyncpg format.

    Render injects DATABASE_URL as postgres:// or postgresql://,
    both of which default to the psycopg2 (sync) driver. SQLAlchemy's
    create_async_engine requires postgresql+asyncpg://.
    """
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


async def init_db() -> None:
    """Create the async engine and initialize tables. Call once at startup."""
    global _engine, _async_session_factory

    from app.config import get_settings
    settings = get_settings()

    db_url = _fix_db_url(settings.DATABASE_URL)
    logger.info("Connecting to database (scheme=%s)", db_url.split("://")[0])

    engine_kwargs: dict = {
        "echo": (settings.APP_ENV == "development"),
    }

    if db_url.startswith("postgresql"):
        engine_kwargs.update({
            "pool_size": 5,
            "max_overflow": 5,
            "pool_pre_ping": True,
        })

    _engine = create_async_engine(db_url, **engine_kwargs)
    _async_session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create tables (safe to call repeatedly — no-ops for existing tables)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized successfully")


async def close_db() -> None:
    """Dispose of the engine. Call once at shutdown."""
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
        logger.info("Database connection closed")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection for async database sessions."""
    if _async_session_factory is None:
        raise RuntimeError("Database not initialized — call init_db() first")
    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
