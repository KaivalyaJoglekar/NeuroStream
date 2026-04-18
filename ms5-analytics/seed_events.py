#!/usr/bin/env python3
"""Seed script: generates realistic synthetic events for testing MS5 analytics.

Usage:
    python seed_events.py [--base-url http://localhost:8085] [--secret your_shared_internal_secret]

This sends a realistic stream of user interactions (searches, seeks, replays, pauses)
clustered around a few "interesting" timestamps to validate that the analytics
algorithms produce meaningful highlights and revisited segments.
"""
import argparse
import random
import sys
import time

import httpx


INTERESTING_TIMESTAMPS = [
    (140.0, "gradient descent"),        # Lecture key concept
    (320.0, "backpropagation"),         # Another key concept
    (510.0, "learning rate tuning"),    # Third concept
    (42.0, None),                       # Interesting intro moment (no search)
    (780.0, "regularization"),          # Late in the video
]

USER_ID = "usr_test"
VIDEO_ID = "vid_test_001"
SESSION_ID = "sess_seed_001"


def generate_events():
    """Generate a realistic event sequence."""
    events = []

    for ts_base, query in INTERESTING_TIMESTAMPS:
        # Multiple search events (if query exists)
        if query:
            for _ in range(random.randint(2, 4)):
                offset = random.uniform(-2.0, 3.0)
                events.append({
                    "user_id": USER_ID,
                    "video_id": VIDEO_ID,
                    "event_type": "SEARCH",
                    "timestamp_sec": round(ts_base + offset, 1),
                    "query_text": query,
                    "session_id": SESSION_ID,
                })

        # Multiple replay events around this timestamp
        for _ in range(random.randint(2, 5)):
            offset = random.uniform(-3.0, 3.0)
            events.append({
                "user_id": USER_ID,
                "video_id": VIDEO_ID,
                "event_type": "REPLAY",
                "timestamp_sec": round(ts_base + offset, 1),
                "session_id": SESSION_ID,
            })

        # Some seek events
        for _ in range(random.randint(1, 3)):
            offset = random.uniform(-5.0, 5.0)
            events.append({
                "user_id": USER_ID,
                "video_id": VIDEO_ID,
                "event_type": "SEEK",
                "timestamp_sec": round(ts_base + offset, 1),
                "session_id": SESSION_ID,
            })

        # A pause event
        events.append({
            "user_id": USER_ID,
            "video_id": VIDEO_ID,
            "event_type": "PAUSE",
            "timestamp_sec": round(ts_base + random.uniform(0, 2.0), 1),
            "session_id": SESSION_ID,
        })

        # A play event (resuming)
        events.append({
            "user_id": USER_ID,
            "video_id": VIDEO_ID,
            "event_type": "PLAY",
            "timestamp_sec": round(ts_base + random.uniform(0, 2.0), 1),
            "session_id": SESSION_ID,
        })

    # Shuffle to simulate realistic arrival order
    random.shuffle(events)
    return events


def main():
    parser = argparse.ArgumentParser(description="Seed MS5 with synthetic events")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8085",
        help="MS5 base URL (default: http://localhost:8085)",
    )
    parser.add_argument(
        "--secret",
        default="your_shared_internal_secret",
        help="Internal API secret",
    )
    args = parser.parse_args()

    events = generate_events()
    print(f"Generated {len(events)} synthetic events")
    print(f"Target: {args.base_url}/api/v1/events")
    print()

    headers = {
        "Content-Type": "application/json",
        "X-Internal-Secret": args.secret,
    }

    success = 0
    failed = 0

    with httpx.Client(base_url=args.base_url, timeout=10.0) as client:
        for i, event in enumerate(events, 1):
            try:
                resp = client.post("/api/v1/events", json=event, headers=headers)
                if resp.status_code == 201:
                    success += 1
                    print(f"  [{i}/{len(events)}] ✓ {event['event_type']:8s} ts={event['timestamp_sec']:7.1f}"
                          f"  {event.get('query_text', '')}")
                else:
                    failed += 1
                    print(f"  [{i}/{len(events)}] ✗ {resp.status_code}: {resp.text[:80]}")
            except httpx.RequestError as e:
                failed += 1
                print(f"  [{i}/{len(events)}] ✗ Connection error: {e}")

    print()
    print(f"Done: {success} sent, {failed} failed")

    # Now fetch analytics
    print()
    print("Fetching analytics...")
    try:
        with httpx.Client(base_url=args.base_url, timeout=10.0) as client:
            resp = client.get(
                f"/api/v1/analytics/{USER_ID}/{VIDEO_ID}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"  Important sections: {len(data.get('important_sections', []))}")
                for s in data.get("important_sections", [])[:5]:
                    print(f"    #{s['rank']}: {s['start_sec']:.0f}s - {s['end_sec']:.0f}s "
                          f"(score={s['score']}) \"{s['label']}\" [{', '.join(s['signals'])}]")

                print(f"  Smart highlights: {len(data.get('smart_highlights', []))}")
                for h in data.get("smart_highlights", []):
                    print(f"    {h['start_sec']:.0f}s - {h['end_sec']:.0f}s "
                          f"(score={h['score']}) \"{h['label']}\"")

                print(f"  Query history: {len(data.get('query_history', []))}")
                print(f"  Revisited segments: {len(data.get('revisited_segments', []))}")
                print(f"  Last computed: {data.get('last_computed_at')}")
            else:
                print(f"  ✗ {resp.status_code}: {resp.text[:200]}")
    except httpx.RequestError as e:
        print(f"  ✗ Connection error: {e}")


if __name__ == "__main__":
    main()
