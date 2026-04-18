"""Tests for the event ingestion endpoint and related utilities."""
import pytest
import pytest_asyncio

from app.utils.time_utils import bucket_timestamp
from app.models.schemas import UserEventRequest, EventType


class TestBucketTimestamp:
    """Tests for the timestamp bucketing utility."""

    def test_exact_boundary(self):
        assert bucket_timestamp(140.0, 5) == 140

    def test_within_bucket(self):
        assert bucket_timestamp(141.8, 5) == 140
        assert bucket_timestamp(143.5, 5) == 140
        assert bucket_timestamp(144.9, 5) == 140

    def test_next_bucket(self):
        assert bucket_timestamp(145.0, 5) == 145
        assert bucket_timestamp(146.3, 5) == 145

    def test_zero(self):
        assert bucket_timestamp(0.0, 5) == 0

    def test_large_timestamp(self):
        assert bucket_timestamp(3600.0, 5) == 3600
        assert bucket_timestamp(3601.5, 5) == 3600

    def test_different_bucket_size(self):
        assert bucket_timestamp(142.5, 10) == 140
        assert bucket_timestamp(149.9, 10) == 140
        assert bucket_timestamp(150.0, 10) == 150


class TestEventValidation:
    """Tests for event request validation."""

    def test_valid_search_event(self):
        event = UserEventRequest(
            user_id="usr_test",
            video_id="vid_test",
            event_type=EventType.SEARCH,
            timestamp_sec=142.5,
            query_text="gradient descent",
            session_id="sess_001",
        )
        assert event.event_type == EventType.SEARCH
        assert event.query_text == "gradient descent"

    def test_valid_seek_event(self):
        event = UserEventRequest(
            user_id="usr_test",
            video_id="vid_test",
            event_type=EventType.SEEK,
            timestamp_sec=50.0,
        )
        assert event.timestamp_sec == 50.0
        assert event.query_text is None

    def test_valid_replay_event(self):
        event = UserEventRequest(
            user_id="usr_test",
            video_id="vid_test",
            event_type=EventType.REPLAY,
            timestamp_sec=120.0,
        )
        assert event.event_type == EventType.REPLAY

    def test_invalid_event_type(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            UserEventRequest(
                user_id="usr_test",
                video_id="vid_test",
                event_type="INVALID_TYPE",
                timestamp_sec=50.0,
            )


# ---------- HTTP endpoint tests ----------


@pytest.mark.asyncio
class TestEventEndpoint:
    """Integration tests for POST /api/v1/events."""

    async def test_post_search_event(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEARCH",
                "timestamp_sec": 142.5,
                "query_text": "gradient descent",
                "session_id": "sess_001",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "recorded"
        assert "event_id" in data

    async def test_post_seek_event(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
                "timestamp_sec": 50.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_post_replay_event(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "REPLAY",
                "timestamp_sec": 120.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_post_pause_event(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "PAUSE",
                "timestamp_sec": 80.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_post_play_event(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "PLAY",
                "timestamp_sec": 80.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_missing_secret_returns_403(self, client):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
                "timestamp_sec": 50.0,
            },
        )
        assert resp.status_code == 403

    async def test_wrong_secret_returns_403(self, client):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
                "timestamp_sec": 50.0,
            },
            headers={"X-Internal-Secret": "wrong_secret"},
        )
        assert resp.status_code == 403

    async def test_missing_timestamp_returns_422(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEEK",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_search_without_query_returns_422(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "SEARCH",
                "timestamp_sec": 100.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_invalid_event_type_returns_422(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/events",
            json={
                "user_id": "usr_test",
                "video_id": "vid_test_001",
                "event_type": "INVALID",
                "timestamp_sec": 100.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422
