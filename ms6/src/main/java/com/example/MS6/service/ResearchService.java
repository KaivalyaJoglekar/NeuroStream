package com.example.MS6.service;

import com.example.MS6.agent.*;
import com.example.MS6.dto.AgentModels.AnalyzedFact;
import com.example.MS6.dto.Ms3Types;
import com.example.MS6.dto.RequestTypes;
import com.example.MS6.dto.ResponseTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Deep agentic research pipeline.
 * Planner → iterative (Retriever + Analyzer) → Synthesizer → CitationLinker
 */
@Service
public class ResearchService {

    private static final Logger log = LoggerFactory.getLogger(ResearchService.class);

    private final RetrieverAgent retriever;
    private final AnalyzerAgent analyzer;
    private final SynthesizerAgent synthesizer;
    private final CitationLinkerAgent citationLinker;
    private final PlannerAgent planner;
    private final int maxIterations;

    public ResearchService(
            RetrieverAgent retriever, AnalyzerAgent analyzer,
            SynthesizerAgent synthesizer, CitationLinkerAgent citationLinker,
            PlannerAgent planner,
            @Value("${agent.research-max-iterations}") int maxIterations) {
        this.retriever = retriever;
        this.analyzer = analyzer;
        this.synthesizer = synthesizer;
        this.citationLinker = citationLinker;
        this.planner = planner;
        this.maxIterations = maxIterations;
    }

    public ResponseTypes.ResearchResponse research(RequestTypes.ResearchRequest request) {
        var trace = new LinkedHashMap<String, Object>();
        long t;

        int resolvedMax = request.maxIterations() != null
                ? Math.min(request.maxIterations(), maxIterations)
                : maxIterations;

        // 1. Plan sub-queries
        t = System.currentTimeMillis();
        List<String> subQueries = planner.plan(request.topic());
        trace.put("planner", Map.of(
                "sub_queries_generated", subQueries.size(),
                "queries", subQueries,
                "latency_ms", System.currentTimeMillis() - t));

        // 2. Iterative retrieval + analysis
        List<AnalyzedFact> factPool = new ArrayList<>();
        List<Map<String, Object>> loopTrace = new ArrayList<>();
        Set<String> videosReferenced = new HashSet<>();
        int iteration = 0;

        for (String query : subQueries) {
            if (iteration >= resolvedMax) break;
            iteration++;

            t = System.currentTimeMillis();
            Ms3Types.SearchResponse searchResp;

            if (request.videoIds() != null && !request.videoIds().isEmpty()) {
                // Search each specified video and merge results
                List<Ms3Types.SearchResult> merged = new ArrayList<>();
                for (String vid : request.videoIds()) {
                    var resp = retriever.searchInVideo(query, vid, 10);
                    merged.addAll(resp.results());
                }
                searchResp = new Ms3Types.SearchResponse(merged, merged.size(), "multi");
            } else {
                searchResp = retriever.searchGlobal(query, null, 10);
            }

            // Convert to context blocks
            List<String> blocks = searchResp.results().stream()
                    .map(r -> {
                        videosReferenced.add(r.videoId());
                        return String.format("[%.2f-%.2f] %s (source=%s)",
                                r.startTime(), r.endTime(), r.text(), r.source());
                    })
                    .collect(Collectors.toList());

            var facts = analyzer.analyze(query, blocks);
            factPool.addAll(facts);

            loopTrace.add(Map.of(
                    "iteration", iteration,
                    "query", query,
                    "chunks_found", searchResp.total(),
                    "facts_extracted", facts.size(),
                    "latency_ms", System.currentTimeMillis() - t));
        }

        trace.put("retriever_loop", loopTrace);

        if (factPool.isEmpty()) {
            return new ResponseTypes.ResearchResponse(
                    "No relevant information found for this research topic.",
                    0, 0, iteration, trace);
        }

        // 3. Synthesize research report
        t = System.currentTimeMillis();
        String report = synthesizer.synthesize(request.topic(), factPool, null);
        trace.put("synthesizer", Map.of(
                "report_length", report.length(),
                "latency_ms", System.currentTimeMillis() - t));

        // 4. Link citations
        t = System.currentTimeMillis();
        var citations = citationLinker.linkCitations(report, factPool);
        trace.put("citation_linker", Map.of(
                "citations_matched", citations.size(),
                "latency_ms", System.currentTimeMillis() - t));

        return new ResponseTypes.ResearchResponse(
                report, factPool.size(), videosReferenced.size(), iteration, trace);
    }
}
