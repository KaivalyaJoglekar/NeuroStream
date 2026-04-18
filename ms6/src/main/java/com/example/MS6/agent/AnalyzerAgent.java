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
        sb.append("Extract relevant facts for the question. Return JSON: ");
        sb.append("[{\"fact\":\"\",\"start_time\":0,\"end_time\":0,\"source_text\":\"\"}]. Empty [] if none.\n\n");
        sb.append("Q: ").append(question).append("\n\n");
        for (int i = 0; i < blocks.size(); i++) {
            sb.append(i + 1).append(". ").append(blocks.get(i)).append("\n");
        }
        return sb.toString();
    }
}
