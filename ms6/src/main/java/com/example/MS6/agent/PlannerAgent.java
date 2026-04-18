package com.example.MS6.agent;

import com.example.MS6.client.GeminiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Planner Agent — used by the Research pipeline.
 * Decomposes a broad research topic into focused sub-queries for iterative retrieval.
 */
@Component
public class PlannerAgent {

    private static final Logger log = LoggerFactory.getLogger(PlannerAgent.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;
    private final double temperature;

    public PlannerAgent(
            GeminiClient geminiClient,
            ObjectMapper objectMapper,
            @Value("${agent.planner-temperature}") double temperature) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
    }

    /** Break a topic into 3-4 focused sub-queries. */
    public List<String> plan(String topic) {
        String prompt = "Split into 3 search queries for video transcripts. Return JSON string array.\n\nTopic: " + topic;

        String json = geminiClient.generateJson(prompt, temperature);
        log.debug("PlannerAgent output: {}", json);

        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("PlannerAgent parse failure: {}", json, e);
            return List.of(topic);
        }
    }
}
