import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, close_db
from app.redis_client import init_redis, close_redis
from app.routers import health, events, analytics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    logger.info("Starting MS5 Analytics Service...")
    await init_db()
    await init_redis()
    logger.info(f"MS5 ready (env={settings.APP_ENV}, port={settings.APP_PORT})")
    yield
    # Shutdown
    logger.info("Shutting down MS5...")
    await close_redis()
    await close_db()
    logger.info("MS5 shutdown complete")


app = FastAPI(
    title="NeuroStream MS5 — Personalized Video Analytics",
    description="Per-user behavioral analytics & smart highlights service",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware (permissive for internal service)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(events.router)
app.include_router(analytics.router)
