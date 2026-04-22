package com.example.MS6.agent;

import com.example.MS6.client.Ms3Client;
import com.example.MS6.dto.Ms3Types;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Retriever Agent — pure HTTP, no LLM calls.
 * Fetches transcript data from MS3's search and retrieval endpoints.
 */
@Component
public class RetrieverAgent {

    private static final Logger log = LoggerFactory.getLogger(RetrieverAgent.class);
    public static final String AUDIO_SOURCE = "audio";
    public static final String VISUAL_SOURCE = "visual";

    private final Ms3Client ms3Client;
    private final int defaultLimit;

    public RetrieverAgent(Ms3Client ms3Client, @Value("${ms3.default-limit}") int defaultLimit) {
        this.ms3Client = ms3Client;
        this.defaultLimit = defaultLimit;
    }

    /** Fetch RAG-ready context blocks for a single video. */
    public Ms3Types.ContextResponse fetchContext(String videoId, String query) {
        log.info("RetrieverAgent: context for video={} query='{}'", videoId, query);
        return ms3Client.getContext(videoId, query, defaultLimit, null);
    }

    /** Fetch source-filtered RAG-ready context blocks for a single video. */
    public Ms3Types.ContextResponse fetchContext(String videoId, String query, String source) {
        log.info("RetrieverAgent: context for video={} query='{}' source={}", videoId, query, source);
        return ms3Client.getContext(videoId, query, defaultLimit, source);
    }

    /** Global search across all indexed videos. */
    public Ms3Types.SearchResponse searchGlobal(String query, String language, int limit) {
        log.info("RetrieverAgent: global search query='{}' limit={}", query, limit);
        return ms3Client.search(query, null, language, limit);
    }

    /** Search scoped to a specific video. */
    public Ms3Types.SearchResponse searchInVideo(String query, String videoId, int limit) {
        log.info("RetrieverAgent: scoped search query='{}' video={}", query, videoId);
        return ms3Client.search(query, videoId, null, limit);
    }

    /** Fetch the full ordered transcript for summarization. */
    public List<Ms3Types.ChunkResponse> fetchAllChunks(String videoId) {
        log.info("RetrieverAgent: all chunks for video={}", videoId);
        return ms3Client.getChunks(videoId, null);
    }

    /** Fetch source-filtered ordered chunks for a single video. */
    public List<Ms3Types.ChunkResponse> fetchAllChunks(String videoId, String source) {
        log.info("RetrieverAgent: all chunks for video={} source={}", videoId, source);
        return ms3Client.getChunks(videoId, source);
    }

    /** Check if a video is indexed and ready. */
    public Ms3Types.VideoStatusResponse checkStatus(String videoId) {
        return ms3Client.getVideoStatus(videoId);
    }
}
