package com.example.MS6.dto;

/**
 * Shared data models passed between agents in the pipeline.
 */
public final class AgentModels {

    private AgentModels() {}

    /** A fact extracted by the AnalyzerAgent from a transcript chunk. */
    public record AnalyzedFact(
            String fact,
            double startTime,
            double endTime,
            String sourceText
    ) {}

    /** A citation mapping a claim in the answer to a source timestamp. */
    public record Citation(
            String videoId,
            double startTime,
            double endTime,
            String text,
            String source
    ) {}

    /** A chapter in a video summary. */
    public record Chapter(
            String title,
            double startTime,
            double endTime,
            String summary
    ) {}

    /** A single message in a conversation history. */
    public record ConversationMessage(
            String role,
            String content
    ) {}
}
