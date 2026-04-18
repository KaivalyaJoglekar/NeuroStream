package com.example.MS6.dto;

import java.util.List;
import java.util.Map;

/**
 * Outbound response DTOs for MS6 API endpoints.
 * Every response includes an agentTrace for observability.
 */
public final class ResponseTypes {

    private ResponseTypes() {}

    public record ChatResponse(
            String answer,
            List<AgentModels.Citation> citations,
            Map<String, Object> agentTrace
    ) {}

    public record SummarizeResponse(
            String videoId,
            String title,
            String summary,
            List<AgentModels.Chapter> chapters,
            Map<String, Object> agentTrace
    ) {}

    public record ResearchResponse(
            String report,
            int sourcesUsed,
            int videosAnalyzed,
            int iterationsTaken,
            Map<String, Object> agentTrace
    ) {}
}
