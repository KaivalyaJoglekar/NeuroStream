package com.example.MS6.agent;

import com.example.MS6.client.GeminiClient;
import com.example.MS6.dto.AgentModels.AnalyzedFact;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Analyzer Agent — Gemini call #1.
 * Filters retrieved chunks for relevance and extracts structured facts.
 */
@Component
public class AnalyzerAgent {

    private static final Logger log = LoggerFactory.getLogger(AnalyzerAgent.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;
    private final double temperature;

    public AnalyzerAgent(
            GeminiClient geminiClient,
            ObjectMapper objectMapper,
            @Value("${agent.analyzer-temperature}") double temperature) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
    }

    /**
     * Analyze chunks for relevance to the question.
     * Returns structured facts with timestamps.
     */
    public List<AnalyzedFact> analyze(String question, List<String> contextBlocks) {
        String prompt = buildPrompt(question, contextBlocks);
        String json = geminiClient.generateJson(prompt, temperature);
        log.debug("AnalyzerAgent raw output: {}", json);

        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("AnalyzerAgent parse failure: {}", json, e);
            return List.of();
        }
    }

    private String buildPrompt(String question, List<String> blocks) {
        var sb = new StringBuilder();
        sb.append("You are a video transcript analyst. Given a user question and transcript ");
        sb.append("chunks with timestamps, identify which chunks are directly relevant to ");
        sb.append("the question. For each relevant chunk, extract the key fact.\n\n");
        sb.append("Return a JSON array of objects. Each object must have exactly these fields:\n");
        sb.append("- \"fact\": the key information extracted (string)\n");
        sb.append("- \"start_time\": start timestamp in seconds (number)\n");
        sb.append("- \"end_time\": end timestamp in seconds (number)\n");
        sb.append("- \"source_text\": the original transcript text (string)\n\n");
        sb.append("If no chunks are relevant, return an empty array [].\n\n");
        sb.append("Question: ").append(question).append("\n\nTranscript Chunks:\n");
        for (int i = 0; i < blocks.size(); i++) {
            sb.append(i + 1).append(". ").append(blocks.get(i)).append("\n");
        }
        return sb.toString();
    }
}
