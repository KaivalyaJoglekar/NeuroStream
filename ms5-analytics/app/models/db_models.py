import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Text, Index, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class UserVideoEvent(Base):
    """Raw user interaction event on a video."""

    __tablename__ = "user_video_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(64), nullable=False)
    video_id = Column(String(64), nullable=False)
    event_type = Column(String(32), nullable=False)
    timestamp_sec = Column(Float, nullable=True)
    query_text = Column(Text, nullable=True)
    session_id = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_uve_user_video", "user_id", "video_id"),
        Index("idx_uve_event_type", "event_type"),
        Index("idx_uve_created_at", "created_at"),
    )


class UserVideoAnalytics(Base):
    """Computed analytics summary for a user-video pair."""

    __tablename__ = "user_video_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(64), nullable=False)
    video_id = Column(String(64), nullable=False)
    important_timestamps = Column(JSON, nullable=True)
    smart_highlights = Column(JSON, nullable=True)
    query_history = Column(JSON, nullable=True)
    revisited_segments = Column(JSON, nullable=True)
    last_computed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_uva_user_video", "user_id", "video_id", unique=True),
    )


# --- Stub tables for MS4-owned data (read-only for MS5) ---

class Video(Base):
    """Stub for MS4-owned videos table (read-only for MS5)."""

    __tablename__ = "videos"

    video_id = Column(String(64), primary_key=True)
    title = Column(String(500), nullable=True)
    total_duration_seconds = Column(Float, nullable=True)
    user_id = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=True,
        default=lambda: datetime.now(timezone.utc),
    )


class VideoChunk(Base):
    """Stub for MS4-owned video_chunks table (read-only for MS5)."""

    __tablename__ = "video_chunks"

    chunk_id = Column(String(64), primary_key=True)
    video_id = Column(String(64), nullable=False)
    chunk_index = Column(Float, nullable=False)
    start_time_seconds = Column(Float, nullable=False)
    end_time_seconds = Column(Float, nullable=False)
