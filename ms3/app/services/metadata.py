from __future__ import annotations

from typing import Sequence
from uuid import UUID

from app.core.db import SearchRepository
from app.models.schemas import ContextResponse, SearchResult, VideoStatusResponse


class MetadataService:
    def __init__(self, repository: SearchRepository) -> None:
        self._repository = repository

    async def get_status(self, video_id: UUID) -> VideoStatusResponse | None:
        return await self._repository.get_status(video_id)

    async def get_chunks(self, video_id: UUID, source: str | None = None):
        return await self._repository.get_chunks(video_id, source)

    async def build_context(
        self,
        *,
        video_id: UUID,
        query_text: str | None,
        query_embedding: Sequence[float] | None,
        limit: int,
        source: str | None = None,
    ) -> ContextResponse:
        if query_text or query_embedding:
            chunks: Sequence[SearchResult] = await self._repository.search(
                query_text=query_text,
                query_embedding=query_embedding,
                video_id=video_id,
                language=None,
                title_contains=None,
                source=source,
                limit=limit,
            )
            blocks = [
                (
                    f"[{chunk.start_time:.2f}-{chunk.end_time:.2f}] "
                    f"{chunk.text} (source={chunk.source}, score={chunk.score:.3f})"
                )
                for chunk in chunks
            ]
            if not blocks:
                blocks = [
                    f"[{chunk.start_time:.2f}-{chunk.end_time:.2f}] {chunk.text} (source={chunk.source})"
                    for chunk in await self._repository.get_chunks(video_id, source)
                ][:limit]
        else:
            blocks = [
                f"[{chunk.start_time:.2f}-{chunk.end_time:.2f}] {chunk.text} (source={chunk.source})"
                for chunk in await self._repository.get_chunks(video_id, source)
            ][:limit]

        return ContextResponse(
            video_id=video_id,
            context_blocks=blocks,
            storage_backend=self._repository.backend_name,
        )
