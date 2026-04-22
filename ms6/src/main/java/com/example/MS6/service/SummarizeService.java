package com.example.MS6.service;

import com.example.MS6.agent.RetrieverAgent;
import com.example.MS6.agent.SummarizerAgent;
import com.example.MS6.dto.Ms3Types.ChunkResponse;
import com.example.MS6.dto.RequestTypes;
import com.example.MS6.dto.ResponseTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Orchestrates the Map-Reduce summarization pipeline.
 * Fetches all chunks → splits into windows → MAP each → REDUCE into final summary.
 */
@Service
public class SummarizeService {

    private static final Logger log = LoggerFactory.getLogger(SummarizeService.class);

    private final RetrieverAgent retriever;
    private final SummarizerAgent summarizer;
    private final int windowSeconds;

    public SummarizeService(
            RetrieverAgent retriever,
            SummarizerAgent summarizer,
            @Value("${agent.summarize-window-seconds}") int windowSeconds) {
        this.retriever = retriever;
        this.summarizer = summarizer;
        this.windowSeconds = windowSeconds;
    }

    public ResponseTypes.SummarizeResponse summarize(RequestTypes.SummarizeRequest request) {
        var trace = new LinkedHashMap<String, Object>();
        long t;

        // 1. Fetch full transcript from MS3
        t = System.currentTimeMillis();
        List<ChunkResponse> chunks = retriever.fetchAllChunks(request.videoId(), RetrieverAgent.AUDIO_SOURCE);
        trace.put("retriever", Map.of(
                "source_preference", RetrieverAgent.AUDIO_SOURCE,
                "total_chunks", chunks.size(),
                "latency_ms", System.currentTimeMillis() - t));

        if (chunks.isEmpty()) {
            t = System.currentTimeMillis();
            chunks = retriever.fetchAllChunks(request.videoId());
            trace.put("retriever_fallback", Map.of(
                    "mode", "all_chunks",
                    "total_chunks", chunks.size(),
                    "latency_ms", System.currentTimeMillis() - t));
        }

        if (chunks.isEmpty()) {
            return new ResponseTypes.SummarizeResponse(
                    request.videoId(), null,
                    "No transcript content available for this video.",
                    List.of(), trace);
        }

        // 2. Split into time windows
        List<List<ChunkResponse>> windows = splitIntoWindows(chunks);
        trace.put("chunker", Map.of("segments_created", windows.size()));

        // 3. MAP — summarize each window
        t = System.currentTimeMillis();
        List<Map<String, Object>> segmentSummaries = new ArrayList<>();
        for (var window : windows) {
            double windowStart = window.getFirst().startTime();
            double windowEnd = window.getLast().endTime();
            String windowText = formatWindow(window);
            String segSummary = summarizer.summarizeSegment(windowText, windowStart, windowEnd);
            segmentSummaries.add(Map.of(
                    "start_time", windowStart,
                    "end_time", windowEnd,
                    "summary", segSummary));
        }
        trace.put("map_summarizer", Map.of(
                "summaries_generated", segmentSummaries.size(),
                "latency_ms", System.currentTimeMillis() - t));

        // 4. REDUCE — merge into final summary with chapters
        t = System.currentTimeMillis();
        var reduced = summarizer.reduce(segmentSummaries, request.style());
        trace.put("reduce_synthesizer", Map.of(
                "latency_ms", System.currentTimeMillis() - t));

        return new ResponseTypes.SummarizeResponse(
                request.videoId(), null,
                reduced.summary(), reduced.chapters(), trace);
    }

    private List<List<ChunkResponse>> splitIntoWindows(List<ChunkResponse> chunks) {
        List<List<ChunkResponse>> windows = new ArrayList<>();
        List<ChunkResponse> current = new ArrayList<>();
        double windowEnd = chunks.getFirst().startTime() + windowSeconds;

        for (var chunk : chunks) {
            if (chunk.startTime() >= windowEnd && !current.isEmpty()) {
                windows.add(current);
                current = new ArrayList<>();
                windowEnd = chunk.startTime() + windowSeconds;
            }
            current.add(chunk);
        }
        if (!current.isEmpty()) {
            windows.add(current);
        }
        return windows;
    }

    private String formatWindow(List<ChunkResponse> window) {
        var sb = new StringBuilder();
        for (var chunk : window) {
            sb.append(String.format("[%.1fs] %s%n", chunk.startTime(), chunk.text()));
        }
        return sb.toString();
    }
}
