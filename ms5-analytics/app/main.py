import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, close_db
from app.routers import health, events, analytics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Starting MS5 Analytics Service...")
    await init_db()
    logger.info(f"MS5 ready (env={settings.APP_ENV}, port={settings.APP_PORT})")
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

app.include_router(health.router)
app.include_router(events.router)
app.include_router(analytics.router)
