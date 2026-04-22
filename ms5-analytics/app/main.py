import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Starting MS5 Analytics Service...")
    logger.info("DATABASE_URL scheme: %s", settings.DATABASE_URL.split("://")[0])

    from app.database import init_db, close_db
    try:
        await init_db()
    except Exception:
        logger.exception("FATAL: Database init failed")
        raise

    logger.info("MS5 ready (env=%s, port=%s)", settings.APP_ENV, settings.APP_PORT)
    yield
    logger.info("Shutting down MS5...")
    await close_db()
    logger.info("MS5 shutdown complete")


app = FastAPI(
    title="NeuroStream MS5 — Personalized Video Analytics",
    description="Per-user behavioral analytics & smart highlights service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers AFTER app is created (they import from database which is
# now lazy, so this is safe — they just reference get_db as a dependency).
from app.routers import health, events, analytics  # noqa: E402

app.include_router(health.router)
app.include_router(events.router)
app.include_router(analytics.router)
