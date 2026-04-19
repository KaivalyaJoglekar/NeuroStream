import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Text, Index, DateTime, JSON
from app.database import Base


class UserVideoEvent(Base):
    """Raw user interaction event on a video."""

    __tablename__ = "user_video_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), nullable=False)
    video_id = Column(String(64), nullable=False)
    event_type = Column(String(32), nullable=False)
    timestamp_sec = Column(Float, nullable=True)
    query_text = Column(Text, nullable=True)
    session_id = Column(String(64), nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_uve_user_video", "user_id", "video_id"),
        Index("idx_uve_event_type", "event_type"),
    )


class UserVideoAnalytics(Base):
    """Computed analytics summary for a user-video pair."""

    __tablename__ = "user_video_analytics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), nullable=False)
    video_id = Column(String(64), nullable=False)
    important_timestamps = Column(JSON, nullable=True)
    smart_highlights = Column(JSON, nullable=True)
    query_history = Column(JSON, nullable=True)
    revisited_segments = Column(JSON, nullable=True)
    last_computed_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_uva_user_video", "user_id", "video_id", unique=True),
    )
