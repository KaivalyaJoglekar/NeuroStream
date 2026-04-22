package com.example.MS6.service;

import com.example.MS6.agent.AnalyzerAgent;
import com.example.MS6.agent.CitationLinkerAgent;
import com.example.MS6.agent.RetrieverAgent;
import com.example.MS6.agent.SynthesizerAgent;
import com.example.MS6.dto.AgentModels.AnalyzedFact;
import com.example.MS6.dto.RequestTypes;
import com.example.MS6.dto.ResponseTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Orchestrates the 4-agent pipeline for conversational Q&A.
 * Used by both /chat (single video) and /search-chat (cross-library).
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int FALLBACK_MAX_CHUNKS = 20;

    private final RetrieverAgent retriever;
    private final AnalyzerAgent analyzer;
    private final SynthesizerAgent synthesizer;
    private final CitationLinkerAgent citationLinker;

    public ChatService(RetrieverAgent retriever, AnalyzerAgent analyzer,
                       SynthesizerAgent synthesizer, CitationLinkerAgent citationLinker) {
        this.retriever = retriever;
        this.analyzer = analyzer;
        this.synthesizer = synthesizer;
        this.citationLinker = citationLinker;
    }

    /**
     * Single-video Q&A: Retriever → Analyzer → Synthesizer → CitationLinker
     */
    public ResponseTypes.ChatResponse chat(RequestTypes.ChatRequest request) {
        var trace = new LinkedHashMap<String, Object>();
        long t;

        // 1. Retrieve context from MS3
        t = System.currentTimeMillis();
        var context = retriever.fetchContext(request.videoId(), request.question());
        trace.put("retriever", Map.of(
                "chunks_fetched", context.contextBlocks().size(),
                "latency_ms", System.currentTimeMillis() - t));

        List<String> contextBlocks = context.contextBlocks();
        if (contextBlocks.isEmpty()) {
            // Fallback to full transcript chunks when semantic context search returns empty.
            t = System.currentTimeMillis();
            contextBlocks = retriever.fetchAllChunks(request.videoId()).stream()
                    .limit(FALLBACK_MAX_CHUNKS)
                    .map(chunk -> String.format("[%.2f-%.2f] %s (source=%s)",
                            chunk.startTime(), chunk.endTime(), chunk.text(), chunk.source()))
                    .collect(Collectors.toList());
            trace.put("retriever_fallback", Map.of(
                    "mode", "video_chunks",
                    "chunks_fetched", contextBlocks.size(),
                    "latency_ms", System.currentTimeMillis() - t));
        }

        if (contextBlocks.isEmpty()) {
            return new ResponseTypes.ChatResponse(
                    "No relevant content found in this video.", List.of(), trace);
        }

        // 2–4. Run analysis pipeline
        return runPipeline(request.question(), contextBlocks,
                request.conversationHistory(), trace);
    }

    /**
     * Cross-library search chat: global search → same analysis pipeline.
     */
    public ResponseTypes.ChatResponse searchChat(RequestTypes.SearchChatRequest request) {
        var trace = new LinkedHashMap<String, Object>();
        long t;

        // 1. Global search via MS3
        t = System.currentTimeMillis();
        var searchResponse = retriever.searchGlobal(request.question(), request.language(), 8);
        trace.put("retriever", Map.of(
                "chunks_fetched", searchResponse.total(),
                "latency_ms", System.currentTimeMillis() - t));

        if (searchResponse.results().isEmpty()) {
            return new ResponseTypes.ChatResponse(
                    "No matching content found across your video library.", List.of(), trace);
        }

        // Convert search results to context block strings for the analyzer
        List<String> contextBlocks = searchResponse.results().stream()
                .map(r -> String.format("[%.2f-%.2f] %s (video=%s, source=%s, score=%.3f)",
                        r.startTime(), r.endTime(), r.text(),
                        r.title() != null ? r.title() : r.videoId(),
                        r.source(), r.score()))
                .collect(Collectors.toList());

        // 2–4. Run analysis pipeline
        return runPipeline(request.question(), contextBlocks, null, trace);
    }

    /** Shared pipeline: Analyzer → Synthesizer → CitationLinker */
    private ResponseTypes.ChatResponse runPipeline(
            String question, List<String> contextBlocks,
            List<com.example.MS6.dto.AgentModels.ConversationMessage> history,
            LinkedHashMap<String, Object> trace) {
        long t;

        // 2. Analyze
        t = System.currentTimeMillis();
        List<AnalyzedFact> facts = analyzer.analyze(question, contextBlocks);
        trace.put("analyzer", Map.of(
                "relevant_facts", facts.size(),
                "latency_ms", System.currentTimeMillis() - t));

        if (facts.isEmpty()) {
            return new ResponseTypes.ChatResponse(
                    "The video content does not appear to address your question.",
                    List.of(), trace);
        }

        // 3. Synthesize
        t = System.currentTimeMillis();
        String answer = synthesizer.synthesize(question, facts, history);
        trace.put("synthesizer", Map.of(
                "answer_length", answer.length(),
                "latency_ms", System.currentTimeMillis() - t));

        // 4. Link citations
        t = System.currentTimeMillis();
        var citations = citationLinker.linkCitations(answer, facts);
        trace.put("citation_linker", Map.of(
                "citations_matched", citations.size(),
                "latency_ms", System.currentTimeMillis() - t));

        return new ResponseTypes.ChatResponse(answer, citations, trace);
    }
}
