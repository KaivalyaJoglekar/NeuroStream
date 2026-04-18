package com.example.MS6.agent;

import com.example.MS6.client.GeminiClient;
import com.example.MS6.dto.AgentModels.AnalyzedFact;
import com.example.MS6.dto.AgentModels.Citation;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Citation Linker Agent — Gemini call #3.
 * Maps factual claims in the synthesized answer back to source timestamps.
 */
@Component
public class CitationLinkerAgent {

    private static final Logger log = LoggerFactory.getLogger(CitationLinkerAgent.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;
    private final double temperature;

    public CitationLinkerAgent(
            GeminiClient geminiClient,
            ObjectMapper objectMapper,
            @Value("${agent.citation-temperature}") double temperature) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
    }

    /** Link claims in the answer to source timestamps. */
    public List<Citation> linkCitations(String answer, List<AnalyzedFact> facts) {
        String prompt = buildPrompt(answer, facts);
        String json = geminiClient.generateJson(prompt, temperature);
        log.debug("CitationLinkerAgent raw output: {}", json);

        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("CitationLinkerAgent parse failure: {}", json, e);
            return List.of();
        }
    }

    private String buildPrompt(String answer, List<AnalyzedFact> facts) {
        var sb = new StringBuilder();
        sb.append("You are a citation engine. Given an answer text and source facts from ");
        sb.append("video transcripts, produce a JSON array of citations. Map each factual ");
        sb.append("claim in the answer to the source fact it came from.\n\n");
        sb.append("Each citation must have:\n");
        sb.append("- \"start_time\": start timestamp in seconds (number)\n");
        sb.append("- \"end_time\": end timestamp in seconds (number)\n");
        sb.append("- \"text\": the original source transcript text (string)\n");
        sb.append("- \"source\": \"audio\" or \"visual\" (string)\n\n");
        sb.append("Answer:\n").append(answer).append("\n\n");
        sb.append("Source Facts:\n");
        for (var fact : facts) {
            sb.append(String.format("- [%.2f-%.2f] %s%n",
                    fact.startTime(), fact.endTime(), fact.sourceText()));
        }
        return sb.toString();
    }
}
