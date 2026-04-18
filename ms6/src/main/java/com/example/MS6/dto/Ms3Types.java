package com.example.MS6.dto;

import java.util.List;

/**
 * Mirror DTOs for MS3 (Search and Indexing) API responses.
 * Field names use camelCase; global SNAKE_CASE Jackson strategy handles JSON mapping.
 */
public final class Ms3Types {

    private Ms3Types() {}

    public record SearchResult(
            String videoId,
            String title,
            String language,
            int chunkId,
            int chunkIndex,
            double startTime,
            double endTime,
            String text,
            String source,
            double score,
            String frameRef
    ) {}

    public record SearchResponse(
            List<SearchResult> results,
            int total,
            String storageBackend
    ) {}

    public record ContextResponse(
            String videoId,
            List<String> contextBlocks,
            String storageBackend
    ) {}

    public record ChunkResponse(
            int id,
            String videoId,
            int chunkIndex,
            double startTime,
            double endTime,
            String text,
            String source,
            String frameRef
    ) {}

    public record VideoStatusResponse(
            String videoId,
            String status,
            String indexedAt
    ) {}
}
