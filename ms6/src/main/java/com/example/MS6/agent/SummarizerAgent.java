package com.example.MS6.agent;

import com.example.MS6.client.GeminiClient;
import com.example.MS6.dto.AgentModels.Chapter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Summarizer Agent — handles both MAP and REDUCE stages
 * of the Map-Reduce summarization pipeline.
 */
@Component
public class SummarizerAgent {

    private static final Logger log = LoggerFactory.getLogger(SummarizerAgent.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;
    private final double temperature;

    public SummarizerAgent(
            GeminiClient geminiClient,
            ObjectMapper objectMapper,
            @Value("${agent.summarizer-temperature}") double temperature) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
    }

    /** MAP step: summarize a single transcript time window. */
    public String summarizeSegment(String segmentText, double startTime, double endTime) {
        String prompt = "You are a video transcript summarizer. Summarize the following " +
                "transcript segment concisely, capturing the key points discussed.\n\n" +
                String.format("Segment [%.0fs - %.0fs]:\n%s", startTime, endTime, segmentText);

        return geminiClient.generateText(prompt, temperature).trim();
    }

    /** REDUCE step: merge segment summaries into a final summary with chapters. */
    @SuppressWarnings("unchecked")
    public ReduceResult reduce(List<Map<String, Object>> segmentSummaries, String style) {
        var sb = new StringBuilder();
        sb.append("You are a video summarization expert. Given segment summaries from a video, ");
        sb.append("produce a cohesive ").append(style != null ? style : "executive").append(" summary.\n\n");
        sb.append("Return a JSON object with:\n");
        sb.append("- \"summary\": overall summary text (string)\n");
        sb.append("- \"chapters\": array of objects with \"title\", \"start_time\", \"end_time\", \"summary\"\n\n");
        sb.append("Segment Summaries:\n");
        for (var seg : segmentSummaries) {
            sb.append(String.format("- [%.0fs-%.0fs]: %s%n",
                    seg.get("start_time"), seg.get("end_time"), seg.get("summary")));
        }

        String json = geminiClient.generateJson(sb.toString(), temperature);
        log.debug("SummarizerAgent reduce output: {}", json);

        try {
            Map<String, Object> result = objectMapper.readValue(json, new TypeReference<>() {});
            String summary = (String) result.getOrDefault("summary", "");
            List<Chapter> chapters = objectMapper.convertValue(
                    result.getOrDefault("chapters", List.of()),
                    new TypeReference<>() {});
            return new ReduceResult(summary, chapters);
        } catch (Exception e) {
            log.error("SummarizerAgent reduce parse failure: {}", json, e);
            return new ReduceResult("Failed to generate summary.", List.of());
        }
    }

    /** Container for reduce output. */
    public record ReduceResult(String summary, List<Chapter> chapters) {}
}
