package com.example.MS6.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * HTTP client for the Gemini REST API.
 * Provides two modes: JSON (structured output) and text (prose output).
 */
@Component
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int maxOutputTokens;

    public GeminiClient(
            @Qualifier("geminiRestClient") RestClient restClient,
            ObjectMapper objectMapper,
            @Value("${gemini.api-key}") String apiKey,
            @Value("${gemini.model}") String model,
            @Value("${gemini.max-output-tokens}") int maxOutputTokens) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.maxOutputTokens = maxOutputTokens;

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY is not set — all LLM calls will fail");
        }
    }

    /** Call Gemini with responseMimeType=application/json for structured output. */
    public String generateJson(String prompt, double temperature) {
        return call(prompt, temperature, "application/json");
    }

    /** Call Gemini with plain text output for prose responses. */
    public String generateText(String prompt, double temperature) {
        return call(prompt, temperature, "text/plain");
    }

    private String call(String prompt, double temperature, String responseMimeType) {
        var body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", temperature,
                        "maxOutputTokens", maxOutputTokens,
                        "responseMimeType", responseMimeType
                )
        );

        log.debug("Gemini call model={} temp={} mime={}", model, temperature, responseMimeType);

        String raw = restClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={key}", model, apiKey)
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(raw);
            String text = root.path("candidates").path(0)
                    .path("content").path("parts").path(0)
                    .path("text").asText();
            if (text == null || text.isBlank()) {
                log.warn("Gemini returned empty text, raw: {}", raw);
                return "";
            }
            return text;
        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", raw, e);
            throw new RuntimeException("Gemini response parse failure", e);
        }
    }
}
