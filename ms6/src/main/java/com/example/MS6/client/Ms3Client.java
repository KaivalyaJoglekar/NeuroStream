package com.example.MS6.client;

import com.example.MS6.dto.Ms3Types;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * HTTP client for MS3 (Search and Indexing service).
 * All data retrieval for the agent pipeline flows through here.
 */
@Component
public class Ms3Client {

    private static final Logger log = LoggerFactory.getLogger(Ms3Client.class);

    private final RestClient restClient;

    public Ms3Client(@Qualifier("ms3RestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    /** Global search across all indexed videos. */
    public Ms3Types.SearchResponse search(String query, String videoId, String language, int limit) {
        log.debug("MS3 /search query='{}' videoId={} limit={}", query, videoId, limit);
        return restClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/search");
                    if (query != null) uriBuilder.queryParam("query", query);
                    if (videoId != null) uriBuilder.queryParam("video_id", videoId);
                    if (language != null) uriBuilder.queryParam("language", language);
                    uriBuilder.queryParam("limit", limit);
                    return uriBuilder.build();
                })
                .retrieve()
                .body(Ms3Types.SearchResponse.class);
    }

    /** Fetch RAG-ready context blocks for a single video, optionally ranked by query. */
    public Ms3Types.ContextResponse getContext(String videoId, String query, int limit) {
        log.debug("MS3 /video/{}/context query='{}' limit={}", videoId, query, limit);
        try {
            return restClient.get()
                    .uri(uriBuilder -> {
                        uriBuilder.path("/video/{videoId}/context");
                        if (query != null) uriBuilder.queryParam("query", query);
                        uriBuilder.queryParam("limit", limit);
                        return uriBuilder.build(videoId);
                    })
                    .retrieve()
                    .body(Ms3Types.ContextResponse.class);
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("MS3 returned 404 for video={} — no matching context blocks", videoId);
            return new Ms3Types.ContextResponse(videoId, List.of(), "none");
        }
    }

    /** Fetch the full ordered transcript for a video. */
    public List<Ms3Types.ChunkResponse> getChunks(String videoId) {
        log.debug("MS3 /video/{}/chunks", videoId);
        return restClient.get()
                .uri("/video/{videoId}/chunks", videoId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }

    /** Check indexing readiness status for a video. */
    public Ms3Types.VideoStatusResponse getVideoStatus(String videoId) {
        log.debug("MS3 /video/{}/status", videoId);
        return restClient.get()
                .uri("/video/{videoId}/status", videoId)
                .retrieve()
                .body(Ms3Types.VideoStatusResponse.class);
    }
}
