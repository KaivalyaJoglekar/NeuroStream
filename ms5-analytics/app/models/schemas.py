from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# --- Enums ---

class EventType(str, Enum):
    SEEK = "SEEK"
    REPLAY = "REPLAY"
    SEARCH = "SEARCH"
    PAUSE = "PAUSE"
    PLAY = "PLAY"


# --- Request Schemas ---

class UserEventRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    video_id: str = Field(..., min_length=1, max_length=64)
    event_type: EventType
    timestamp_sec: Optional[float] = None
    query_text: Optional[str] = None
    session_id: Optional[str] = Field(None, max_length=64)


# --- Response Schemas ---

class UserEventResponse(BaseModel):
    event_id: str
    status: str = "recorded"


class ImportantSection(BaseModel):
    rank: int
    start_sec: float
    end_sec: float
    label: str
    score: float
    signals: list[str]


class SmartHighlight(BaseModel):
    start_sec: float
    end_sec: float
    label: str
    score: float


class QueryEntry(BaseModel):
    query_text: str
    searched_at: datetime
    result_timestamp_sec: Optional[float] = None


class RevisitedSegment(BaseModel):
    start_sec: float
    end_sec: float
    replay_count: int


class AnalyticsResponse(BaseModel):
    user_id: str
    video_id: str
    important_sections: list[ImportantSection] = []
    smart_highlights: list[SmartHighlight] = []
    query_history: list[QueryEntry] = []
    revisited_segments: list[RevisitedSegment] = []
    last_computed_at: Optional[datetime] = None


class HighlightsResponse(BaseModel):
    video_id: str
    highlights: list[SmartHighlight] = []


class QueryHistoryResponse(BaseModel):
    video_id: str
    query_history: list[QueryEntry] = []


class RecomputeResponse(BaseModel):
    status: str
    video_id: str


class HealthResponse(BaseModel):
    status: str
    db: str
    redis: str
