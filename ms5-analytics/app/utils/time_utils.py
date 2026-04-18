def bucket_timestamp(ts: float, bucket_size: int = 5) -> int:
    """Returns the start of the bucket this timestamp falls into.

    Example: With bucket_size=5, timestamps 140.1, 141.8, 143.5
    all fall into bucket 140.
    """
    return int(ts // bucket_size) * bucket_size


def merge_adjacent_buckets(
    scored_buckets: list[dict],
    bucket_size: int = 5,
    max_gap_buckets: int = 2,
) -> list[dict]:
    """Merges adjacent scored buckets into contiguous sections.

    Adjacent means within `max_gap_buckets` bucket-lengths of each other.

    Args:
        scored_buckets: List of dicts with 'bucket', 'score', 'signals'.
            Must be sorted by 'bucket' ascending.
        bucket_size: Size of each timestamp bucket in seconds.
        max_gap_buckets: Maximum gap (in bucket counts) to consider adjacent.

    Returns:
        List of merged sections with start_sec, end_sec, total_score, signals.
    """
    if not scored_buckets:
        return []

    # Sort by bucket timestamp
    sorted_buckets = sorted(scored_buckets, key=lambda b: b["bucket"])

    sections = []
    current_section = {
        "start_sec": sorted_buckets[0]["bucket"],
        "end_sec": sorted_buckets[0]["bucket"] + bucket_size,
        "total_score": sorted_buckets[0]["score"],
        "signals": set(sorted_buckets[0].get("signals", [])),
    }

    for i in range(1, len(sorted_buckets)):
        bucket = sorted_buckets[i]
        gap = bucket["bucket"] - (current_section["end_sec"])

        if gap <= max_gap_buckets * bucket_size:
            # Merge into current section
            current_section["end_sec"] = bucket["bucket"] + bucket_size
            current_section["total_score"] += bucket["score"]
            current_section["signals"].update(bucket.get("signals", []))
        else:
            # Start a new section
            current_section["signals"] = list(current_section["signals"])
            sections.append(current_section)
            current_section = {
                "start_sec": bucket["bucket"],
                "end_sec": bucket["bucket"] + bucket_size,
                "total_score": bucket["score"],
                "signals": set(bucket.get("signals", [])),
            }

    # Don't forget the last section
    current_section["signals"] = list(current_section["signals"])
    sections.append(current_section)

    return sections
