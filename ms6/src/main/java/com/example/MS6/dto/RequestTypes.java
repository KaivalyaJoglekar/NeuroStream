package com.example.MS6.dto;

import java.util.List;

/**
 * Inbound request DTOs for MS6 API endpoints.
 */
public final class RequestTypes {

    private RequestTypes() {}

    public record ChatRequest(
            String videoId,
            String userId,
            String question,
            List<AgentModels.ConversationMessage> conversationHistory
    ) {}

    public record SearchChatRequest(
            String userId,
            String question,
            String language
    ) {}

    public record SummarizeRequest(
            String videoId,
            String userId,
            String style
    ) {}

    public record ResearchRequest(
            String userId,
            String topic,
            List<String> videoIds,
            Integer maxIterations
    ) {}
}
