"""Tests for analytics computation and API endpoints."""
import pytest
import pytest_asyncio

from app.utils.time_utils import bucket_timestamp, merge_adjacent_buckets
from app.services.highlight_service import _get_highlight_label


class TestMergeAdjacentBuckets:
    """Tests for the bucket merging algorithm."""

    def test_single_bucket(self):
        buckets = [{"bucket": 140, "score": 5.0, "signals": ["SEARCH"]}]
        result = merge_adjacent_buckets(buckets, bucket_size=5)
        assert len(result) == 1
        assert result[0]["start_sec"] == 140
        assert result[0]["end_sec"] == 145
        assert result[0]["total_score"] == 5.0

    def test_adjacent_buckets_merge(self):
        buckets = [
            {"bucket": 140, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 145, "score": 3.0, "signals": ["REPLAY"]},
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5, max_gap_buckets=2)
        assert len(result) == 1
        assert result[0]["start_sec"] == 140
        assert result[0]["end_sec"] == 150
        assert result[0]["total_score"] == 8.0

    def test_non_adjacent_buckets_separate(self):
        buckets = [
            {"bucket": 140, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 200, "score": 3.0, "signals": ["REPLAY"]},
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5, max_gap_buckets=2)
        assert len(result) == 2

    def test_gap_within_tolerance(self):
        """Buckets within max_gap_buckets should merge."""
        buckets = [
            {"bucket": 140, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 155, "score": 3.0, "signals": ["SEEK"]},  # Gap = 10s = 2 buckets
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5, max_gap_buckets=2)
        assert len(result) == 1

    def test_gap_exceeds_tolerance(self):
        """Buckets beyond max_gap_buckets should not merge."""
        buckets = [
            {"bucket": 140, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 160, "score": 3.0, "signals": ["SEEK"]},  # Gap = 15s = 3 buckets
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5, max_gap_buckets=2)
        assert len(result) == 2

    def test_empty_input(self):
        result = merge_adjacent_buckets([], bucket_size=5)
        assert result == []

    def test_signals_merged(self):
        buckets = [
            {"bucket": 140, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 145, "score": 3.0, "signals": ["REPLAY"]},
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5)
        assert "SEARCH" in result[0]["signals"]
        assert "REPLAY" in result[0]["signals"]

    def test_multiple_merged_groups(self):
        buckets = [
            {"bucket": 10, "score": 1.0, "signals": ["PAUSE"]},
            {"bucket": 15, "score": 2.0, "signals": ["SEEK"]},
            {"bucket": 100, "score": 5.0, "signals": ["SEARCH"]},
            {"bucket": 105, "score": 3.0, "signals": ["REPLAY"]},
        ]
        result = merge_adjacent_buckets(buckets, bucket_size=5, max_gap_buckets=2)
        assert len(result) == 2
        assert result[0]["total_score"] == 3.0
        assert result[1]["total_score"] == 8.0


class TestSmartHighlights:
    """Tests for the smart highlights generation."""

    def test_highlight_label_from_search(self):
        class MockEvent:
            def __init__(self, event_type, query_text=None):
                self.event_type = event_type
                self.query_text = query_text

        bucket_events = {
            140: [
                MockEvent("SEARCH", "gradient descent"),
                MockEvent("SEARCH", "gradient descent"),
                MockEvent("SEEK"),
            ],
        }

        label = _get_highlight_label(140, 145, bucket_events, 5)
        assert label == "Gradient descent"

    def test_highlight_label_fallback_replay(self):
        class MockEvent:
            def __init__(self, event_type, query_text=None):
                self.event_type = event_type
                self.query_text = query_text

        bucket_events = {
            140: [MockEvent("REPLAY"), MockEvent("REPLAY")],
        }

        label = _get_highlight_label(140, 145, bucket_events, 5)
        assert label == "Frequently revisited"

    def test_highlight_label_fallback_default(self):
        bucket_events = {}
        label = _get_highlight_label(140, 145, bucket_events, 5)
        assert label == "Important moment"


# ---------- HTTP endpoint tests ----------


@pytest.mark.asyncio
class TestAnalyticsEndpoints:
    """Integration tests for analytics API endpoints."""

    async def _seed_events(self, client, auth_headers, count=1):
        """Helper: seed events for a user-video pair."""
        events = [
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEARCH",
                "timestamp_sec": 142.5,
                "query_text": "gradient descent",
                "session_id": "sess_001",
            },
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "REPLAY",
                "timestamp_sec": 140.0,
                "session_id": "sess_001",
            },
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "REPLAY",
                "timestamp_sec": 141.0,
                "session_id": "sess_001",
            },
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
                "timestamp_sec": 320.0,
                "session_id": "sess_001",
            },
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
                "timestamp_sec": 322.0,
                "session_id": "sess_001",
            },
            {
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "PAUSE",
                "timestamp_sec": 320.0,
                "session_id": "sess_001",
            },
        ]
        for event in events[:count]:
            resp = await client.post("/api/v1/events", json=event, headers=auth_headers)
            assert resp.status_code == 201

    async def test_get_analytics_empty(self, client, auth_headers):
        """Analytics for a user-video with no events returns empty fields."""
        resp = await client.get(
            "/api/v1/analytics/usr_test/vid_empty",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "usr_test"
        assert data["video_id"] == "vid_empty"
        assert data["important_sections"] == []
        assert data["smart_highlights"] == []
        assert data["query_history"] == []
        assert data["revisited_segments"] == []

    async def test_get_analytics_with_events(self, client, auth_headers):
        """Analytics returns computed results after seeding events."""
        await self._seed_events(client, auth_headers, count=6)

        resp = await client.get(
            "/api/v1/analytics/usr_test/vid_test_001",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "usr_test"
        assert data["video_id"] == "vid_test_001"
        assert len(data["important_sections"]) > 0
        assert data["last_computed_at"] is not None

    async def test_get_analytics_query_history(self, client, auth_headers):
        """Analytics returns search queries in query_history."""
        await self._seed_events(client, auth_headers, count=1)  # 1 SEARCH event

        resp = await client.get(
            "/api/v1/analytics/usr_test/vid_test_001",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["query_history"]) == 1
        assert data["query_history"][0]["query_text"] == "gradient descent"

    async def test_get_highlights(self, client, auth_headers):
        """Highlights endpoint returns smart_highlights subset."""
        await self._seed_events(client, auth_headers, count=6)

        resp = await client.get(
            "/api/v1/analytics/usr_test/vid_test_001/highlights",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "vid_test_001"
        assert isinstance(data["highlights"], list)

    async def test_get_queries(self, client, auth_headers):
        """Queries endpoint returns query history."""
        await self._seed_events(client, auth_headers, count=1)

        resp = await client.get(
            "/api/v1/analytics/usr_test/vid_test_001/queries",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "vid_test_001"
        assert len(data["query_history"]) == 1

    async def test_recompute(self, client, auth_headers):
        """Recompute endpoint returns 202."""
        await self._seed_events(client, auth_headers, count=3)

        resp = await client.post(
            "/api/v1/analytics/usr_test/vid_test_001/recompute",
            headers=auth_headers,
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "recompute_triggered"
        assert data["video_id"] == "vid_test_001"

    async def test_analytics_requires_auth(self, client):
        """Analytics endpoints require X-Internal-Secret."""
        resp = await client.get("/api/v1/analytics/usr_test/vid_test_001")
        assert resp.status_code == 403

    async def test_highlights_requires_auth(self, client):
        resp = await client.get("/api/v1/analytics/usr_test/vid_test_001/highlights")
        assert resp.status_code == 403

    async def test_queries_requires_auth(self, client):
        resp = await client.get("/api/v1/analytics/usr_test/vid_test_001/queries")
        assert resp.status_code == 403

    async def test_recompute_requires_auth(self, client):
        resp = await client.post("/api/v1/analytics/usr_test/vid_test_001/recompute")
        assert resp.status_code == 403
