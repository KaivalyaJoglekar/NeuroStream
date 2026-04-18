from typing import Any, Optional
from pydantic import BaseModel


# ── MS6 output shapes (mirrors MS6 DTOs) ─────────────────────────────────────

class Citation(BaseModel):
    video_id: Optional[str] = None
    start_time: float
    end_time: float
    text: str
    source: str


class Chapter(BaseModel):
    title: str
    start_time: float
    end_time: float
    summary: str


# ── Inbound request bodies ────────────────────────────────────────────────────

class ChatExportRequest(BaseModel):
    """Export a /chat or /search-chat response from MS6."""
    title: str = "Video Q&A Report"
    question: str
    answer: str
    citations: list[Citation] = []


class SummarizeExportRequest(BaseModel):
    """Export a /summarize response from MS6."""
    video_id: str
    title: str = "Video Summary Report"
    summary: str
    chapters: list[Chapter] = []


class ResearchExportRequest(BaseModel):
    """Export a /research response from MS6."""
    topic: str
    title: str = "Research Report"
    report: str
    sources_used: int = 0
    videos_analyzed: int = 0


# ── Outbound response ─────────────────────────────────────────────────────────

class ExportResponse(BaseModel):
    download_url: str
    s3_key: str
    expires_in_seconds: int
