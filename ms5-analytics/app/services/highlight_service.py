import logging
from collections import Counter

from app.models.schemas import ImportantSection, SmartHighlight

logger = logging.getLogger(__name__)


def generate_smart_highlights(
    important_sections: list[ImportantSection],
    bucket_events: dict,
    bucket_size: int,
    top_n: int = 5,
) -> list[SmartHighlight]:
    """Generates smart highlights from important sections.

    Algorithm:
    1. Filter sections by score threshold (mean score of all sections).
    2. Sort by score descending.
    3. Take top N.
    4. Enrich each with a label from search queries or generic fallback.
    """
    if not important_sections:
        return []

    # Calculate mean score as threshold
    scores = [s.score for s in important_sections]
    mean_score = sum(scores) / len(scores) if scores else 0

    # Filter by threshold (at least mean score)
    qualified = [s for s in important_sections if s.score >= mean_score]

    # Sort by score descending (already sorted, but be safe)
    qualified.sort(key=lambda s: s.score, reverse=True)

    # Take top N
    top_sections = qualified[:top_n]

    # Generate highlights with labels
    highlights = []
    for section in top_sections:
        label = _get_highlight_label(
            section.start_sec, section.end_sec, bucket_events, bucket_size
        )
        highlights.append(
            SmartHighlight(
                start_sec=section.start_sec,
                end_sec=section.end_sec,
                label=label,
                score=section.score,
            )
        )

    logger.info(f"Generated {len(highlights)} smart highlights")
    return highlights


def _get_highlight_label(
    start_sec: float,
    end_sec: float,
    bucket_events: dict,
    bucket_size: int,
) -> str:
    """Determines a human-readable label for a highlight segment.

    Uses the most common search query in the segment if available.
    Falls back to generic labels based on event types.
    """
    search_queries = []
    event_types = set()

    for bucket_ts, events in bucket_events.items():
        if start_sec <= bucket_ts < end_sec:
            for event in events:
                event_types.add(event.event_type)
                if event.event_type == "SEARCH" and event.query_text:
                    search_queries.append(event.query_text)

    # Use most common search query as label
    if search_queries:
        most_common = Counter(search_queries).most_common(1)[0][0]
        return most_common.capitalize()

    # Fallback to generic labels
    if "REPLAY" in event_types:
        return "Frequently revisited"
    if "SEEK" in event_types:
        return "Key section"
    if "PAUSE" in event_types:
        return "Paused moment"

    return "Important moment"
