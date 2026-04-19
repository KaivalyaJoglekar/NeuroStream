package com.example.MS6.controller;

import com.example.MS6.dto.RequestTypes;
import com.example.MS6.dto.ResponseTypes;
import com.example.MS6.service.ChatService;
import com.example.MS6.service.ExportPublisher;
import com.example.MS6.service.ResearchService;
import com.example.MS6.service.SummarizeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Single controller exposing all MS6 "Brain" endpoints.
 * Thin delegation — all logic lives in service classes.
 */
@RestController
@RequestMapping("/api/v1")
public class BrainController {

    private final ChatService chatService;
    private final SummarizeService summarizeService;
    private final ResearchService researchService;
    private final ExportPublisher exportPublisher;

    public BrainController(ChatService chatService,
                           SummarizeService summarizeService,
                           ResearchService researchService,
                           ExportPublisher exportPublisher) {
        this.chatService = chatService;
        this.summarizeService = summarizeService;
        this.researchService = researchService;
        this.exportPublisher = exportPublisher;
    }

    @PostMapping("/chat")
    public ResponseEntity<ResponseTypes.ChatResponse> chat(
            @RequestBody RequestTypes.ChatRequest request) {
        if (request.videoId() == null || request.question() == null) {
            return ResponseEntity.badRequest().build();
        }
        var resp = chatService.chat(request);
        exportPublisher.publish("chat", new java.util.HashMap<>(java.util.Map.of(
            "title", "Video Q&A Report", "question", request.question(),
            "answer", resp.answer(), "citations", resp.citations()
        )));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/search-chat")
    public ResponseEntity<ResponseTypes.ChatResponse> searchChat(
            @RequestBody RequestTypes.SearchChatRequest request) {
        if (request.question() == null) {
            return ResponseEntity.badRequest().build();
        }
        var resp = chatService.searchChat(request);
        exportPublisher.publish("chat", new java.util.HashMap<>(java.util.Map.of(
            "title", "Library Search Q&A", "question", request.question(),
            "answer", resp.answer(), "citations", resp.citations()
        )));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/summarize")
    public ResponseEntity<ResponseTypes.SummarizeResponse> summarize(
            @RequestBody RequestTypes.SummarizeRequest request) {
        if (request.videoId() == null) {
            return ResponseEntity.badRequest().build();
        }
        var resp = summarizeService.summarize(request);
        exportPublisher.publish("summarize", new java.util.HashMap<>(java.util.Map.of(
            "video_id", request.videoId(), "title", "Video Summary Report",
            "summary", resp.summary(), "chapters", resp.chapters() != null ? resp.chapters() : java.util.List.of()
        )));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/research")
    public ResponseEntity<ResponseTypes.ResearchResponse> research(
            @RequestBody RequestTypes.ResearchRequest request) {
        if (request.topic() == null) {
            return ResponseEntity.badRequest().build();
        }
        var resp = researchService.research(request);
        exportPublisher.publish("research", new java.util.HashMap<>(java.util.Map.of(
            "topic", request.topic(), "title", "Research Report",
            "report", resp.report(), "sources_used", resp.sourcesUsed(),
            "videos_analyzed", resp.videosAnalyzed()
        )));
        return ResponseEntity.ok(resp);
    }
}
