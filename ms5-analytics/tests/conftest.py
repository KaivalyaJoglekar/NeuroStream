"""Shared test fixtures for MS5 analytics tests.

Uses an in-memory SQLite database for unit tests (no Postgres required).
Mocks Redis so tests run without any external dependencies.
"""
import asyncio
import os
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Override env vars BEFORE any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_ms5.db"
os.environ["REDIS_URL"] = "redis://localhost:6380/1"
os.environ["INTERNAL_API_SECRET"] = "test_secret"
os.environ["APP_ENV"] = "testing"

from app.database import Base, get_db
from app.redis_client import get_redis
from app.main import app


# ---------- Database fixtures ----------

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_ms5.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create tables, yield a session, then drop tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------- Redis mock ----------

@pytest.fixture
def mock_redis():
    """Returns an AsyncMock of a Redis client."""
    redis = AsyncMock()
    redis.ping = AsyncMock(return_value=True)
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock()
    redis.delete = AsyncMock()
    redis.incrbyfloat = AsyncMock()
    redis.lpush = AsyncMock()
    redis.ltrim = AsyncMock()
    redis.expire = AsyncMock()
    return redis


# ---------- HTTP client ----------

@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession, mock_redis) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client with overridden DB + Redis dependencies."""

    async def _override_get_db():
        yield db_session

    async def _override_get_redis():
        return mock_redis

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_redis] = _override_get_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------- Auth header helper ----------

@pytest.fixture
def auth_headers():
    """Returns headers with the test internal secret."""
    return {"X-Internal-Secret": "test_secret"}
