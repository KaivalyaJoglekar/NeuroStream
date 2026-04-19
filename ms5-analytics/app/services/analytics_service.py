import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import UserVideoEvent, UserVideoAnalytics
from app.models.schemas import (
    AnalyticsResponse,
    ImportantSection,
    RevisitedSegment,
    QueryEntry,
)
from app.services.highlight_service import generate_smart_highlights
from app.utils.time_utils import bucket_timestamp, merge_adjacent_buckets
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Signal weights for importance scoring
SIGNAL_WEIGHTS = {
    "SEARCH": 5.0,
    "REPLAY": 3.0,
    "SEEK": 1.5,
    "PAUSE": 1.0,
    "PLAY": 0.0,
}


async def get_analytics(
    db: AsyncSession,
    user_id: str,
    video_id: str,
) -> AnalyticsResponse:
    """Retrieves or computes analytics for a user-video pair.

    Checks the analytics table first, otherwise computes from raw events.
    """
    # Check for existing computed analytics
    existing = await db.execute(
        select(UserVideoAnalytics).where(
            UserVideoAnalytics.user_id == user_id,
            UserVideoAnalytics.video_id == video_id,
        )
    )
    record = existing.scalar_one_or_none()
    if record and record.last_computed_at:
        return AnalyticsResponse(
            user_id=user_id,
            video_id=video_id,
            important_sections=[ImportantSection(**s) for s in (record.important_timestamps or [])],
            smart_highlights=record.smart_highlights or [],
            query_history=[QueryEntry(**q) for q in (record.query_history or [])],
            revisited_segments=[RevisitedSegment(**r) for r in (record.revisited_segments or [])],
            last_computed_at=record.last_computed_at,
        )

    # Compute fresh from raw events
    analytics = await compute_analytics(db, user_id, video_id)

    # Store the computed result
    await upsert_analytics(db, user_id, video_id, analytics)

    return analytics


async def compute_analytics(
    db: AsyncSession, user_id: str, video_id: str
) -> AnalyticsResponse:
    """Computes analytics by querying all events for a user-video pair."""
    result = await db.execute(
        select(UserVideoEvent)
        .where(
            UserVideoEvent.user_id == user_id,
            UserVideoEvent.video_id == video_id,
        )
        .order_by(UserVideoEvent.created_at)
    )
    events = result.scalars().all()

    if not events:
        return AnalyticsResponse(
            user_id=user_id,
            video_id=video_id,
            last_computed_at=datetime.now(timezone.utc),
        )

    bucket_size = settings.TIMESTAMP_BUCKET_SECONDS

    # 1. Bucket timestamps and compute scores
    bucket_events = defaultdict(list)
    for event in events:
        if event.timestamp_sec is not None:
            bucket = bucket_timestamp(event.timestamp_sec, bucket_size)
            bucket_events[bucket].append(event)

    scored_buckets = []
    for bucket, events_in_bucket in bucket_events.items():
        score = 0.0
        signals = set()
        for event in events_in_bucket:
            weight = SIGNAL_WEIGHTS.get(event.event_type, 0.0)
            score += weight
            if weight > 0:
                signals.add(event.event_type)
        scored_buckets.append({
            "bucket": bucket,
            "score": score,
            "signals": list(signals),
        })

    # 2. Sort by score and take top N buckets
    scored_buckets.sort(key=lambda b: b["score"], reverse=True)
    top_buckets = scored_buckets[: settings.IMPORTANT_SECTIONS_COUNT * 3]

    # 3. Merge adjacent buckets into sections
    sections = merge_adjacent_buckets(top_buckets, bucket_size, max_gap_buckets=2)

    # 4. Sort sections by score and create ImportantSection objects
    sections.sort(key=lambda s: s["total_score"], reverse=True)
    important_sections = []
    for rank, section in enumerate(
        sections[: settings.IMPORTANT_SECTIONS_COUNT], start=1
    ):
        label = _generate_section_label(section, bucket_events, bucket_size)
        important_sections.append(
            ImportantSection(
                rank=rank,
                start_sec=section["start_sec"],
                end_sec=section["end_sec"],
                label=label,
                score=round(section["total_score"], 1),
                signals=section["signals"],
            )
        )

    # 5. Find revisited segments
    revisited_segments = _find_revisited_segments(
        events, bucket_size, settings.MIN_REVISIT_COUNT
    )

    # 6. Extract query history
    query_history = _extract_query_history(events)

    # 7. Generate smart highlights
    smart_highlights = generate_smart_highlights(
        important_sections,
        bucket_events,
        bucket_size,
        settings.TOP_HIGHLIGHTS_COUNT,
    )

    now = datetime.now(timezone.utc)

    return AnalyticsResponse(
        user_id=user_id,
        video_id=video_id,
        important_sections=important_sections,
        smart_highlights=smart_highlights,
        query_history=query_history,
        revisited_segments=revisited_segments,
        last_computed_at=now,
    )


async def recompute_analytics(
    db: AsyncSession, user_id: str, video_id: str
) -> None:
    """Force recomputes analytics: recomputes from raw events and stores."""
    analytics = await compute_analytics(db, user_id, video_id)
    await upsert_analytics(db, user_id, video_id, analytics)


async def upsert_analytics(
    db: AsyncSession,
    user_id: str,
    video_id: str,
    analytics: AnalyticsResponse,
) -> None:
    """Upserts computed analytics into the user_video_analytics table.

    Uses a portable SELECT-then-INSERT/UPDATE pattern instead of
    PostgreSQL-specific ON CONFLICT, so this works on SQLite too.
    """
    now = datetime.now(timezone.utc)
    data = {
        "important_timestamps": [s.model_dump(mode="json") for s in analytics.important_sections],
        "smart_highlights": [h.model_dump(mode="json") for h in analytics.smart_highlights],
        "query_history": [q.model_dump(mode="json") for q in analytics.query_history],
        "revisited_segments": [r.model_dump(mode="json") for r in analytics.revisited_segments],
        "last_computed_at": now,
        "updated_at": now,
    }

    existing = await db.execute(
        select(UserVideoAnalytics).where(
            UserVideoAnalytics.user_id == user_id,
            UserVideoAnalytics.video_id == video_id,
        )
    )
    record = existing.scalar_one_or_none()

    if record:
        for key, value in data.items():
            setattr(record, key, value)
    else:
        record = UserVideoAnalytics(user_id=user_id, video_id=video_id, **data)
        db.add(record)

    await db.flush()
    logger.info(f"Upserted analytics for user={user_id} video={video_id}")


def _find_revisited_segments(
    events: list, bucket_size: int, min_count: int
) -> list[RevisitedSegment]:
    """Identifies segments replayed or seeked to multiple times."""
    replay_seeks = [
        e for e in events
        if e.event_type in ("REPLAY", "SEEK") and e.timestamp_sec is not None
    ]
    bucket_counts = Counter(
        bucket_timestamp(e.timestamp_sec, bucket_size) for e in replay_seeks
    )
    return [
        RevisitedSegment(
            start_sec=bucket,
            end_sec=bucket + bucket_size,
            replay_count=count,
        )
        for bucket, count in sorted(bucket_counts.items())
        if count >= min_count
    ]


def _extract_query_history(events: list) -> list[QueryEntry]:
    """Extracts all SEARCH events as query history."""
    return [
        QueryEntry(
            query_text=e.query_text or "",
            searched_at=e.created_at,
            result_timestamp_sec=e.timestamp_sec,
        )
        for e in events
        if e.event_type == "SEARCH" and e.query_text
    ]


def _generate_section_label(
    section: dict, bucket_events: dict, bucket_size: int
) -> str:
    """Generates a human-readable label for a section based on its signals."""
    start = section["start_sec"]
    end = section["end_sec"]
    search_queries = []

    for bucket_ts, events in bucket_events.items():
        if start <= bucket_ts < end:
            for event in events:
                if event.event_type == "SEARCH" and event.query_text:
                    search_queries.append(event.query_text)

    if search_queries:
        most_common = Counter(search_queries).most_common(1)[0][0]
        return most_common.capitalize()

    signals = section.get("signals", [])
    if "REPLAY" in signals:
        return "Frequently revisited section"
    if "SEEK" in signals:
        return "Frequently accessed section"
    if "PAUSE" in signals:
        return "Key moment"

    return "Important section"
