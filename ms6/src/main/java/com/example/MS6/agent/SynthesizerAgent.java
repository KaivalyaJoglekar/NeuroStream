package com.example.MS6.agent;

import com.example.MS6.client.GeminiClient;
import com.example.MS6.dto.AgentModels.AnalyzedFact;
import com.example.MS6.dto.AgentModels.ConversationMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Synthesizer Agent — Gemini call #2.
 * Composes a natural conversational answer from analyzed facts.
 */
@Component
public class SynthesizerAgent {

    private static final Logger log = LoggerFactory.getLogger(SynthesizerAgent.class);

    private final GeminiClient geminiClient;
    private final double temperature;

    public SynthesizerAgent(
            GeminiClient geminiClient,
            @Value("${agent.synthesizer-temperature}") double temperature) {
        this.geminiClient = geminiClient;
        this.temperature = temperature;
    }

    /** Compose a conversational answer from facts, with optional conversation history. */
    public String synthesize(String question, List<AnalyzedFact> facts,
                             List<ConversationMessage> history) {
        String prompt = buildPrompt(question, facts, history);
        String answer = geminiClient.generateText(prompt, temperature);
        log.debug("SynthesizerAgent produced {} chars", answer.length());
        return answer.trim();
    }

    private String buildPrompt(String question, List<AnalyzedFact> facts,
                               List<ConversationMessage> history) {
        var sb = new StringBuilder();
        sb.append("You are a conversational video research assistant. Using the following ");
        sb.append("verified facts extracted from video transcripts, write a clear, well-structured ");
        sb.append("answer to the user's question. Reference timestamps in [MM:SS] format. ");
        sb.append("Do not hallucinate information not present in the facts.\n\n");

        if (history != null && !history.isEmpty()) {
            sb.append("Conversation History:\n");
            for (var msg : history) {
                sb.append(msg.role()).append(": ").append(msg.content()).append("\n");
            }
            sb.append("\n");
        }

        sb.append("Verified Facts:\n");
        for (var fact : facts) {
            int sm = (int) (fact.startTime() / 60);
            int ss = (int) (fact.startTime() % 60);
            int em = (int) (fact.endTime() / 60);
            int es = (int) (fact.endTime() % 60);
            sb.append(String.format("- [%02d:%02d-%02d:%02d] %s%n", sm, ss, em, es, fact.fact()));
        }

        sb.append("\nUser Question: ").append(question);
        return sb.toString();
    }
}
