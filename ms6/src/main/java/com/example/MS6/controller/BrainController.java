package com.example.MS6.controller;

import com.example.MS6.dto.RequestTypes;
import com.example.MS6.dto.ResponseTypes;
import com.example.MS6.service.ChatService;
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

    public BrainController(ChatService chatService,
                           SummarizeService summarizeService,
                           ResearchService researchService) {
        this.chatService = chatService;
        this.summarizeService = summarizeService;
        this.researchService = researchService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ResponseTypes.ChatResponse> chat(
            @RequestBody RequestTypes.ChatRequest request) {
        if (request.videoId() == null || request.question() == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(chatService.chat(request));
    }

    @PostMapping("/search-chat")
    public ResponseEntity<ResponseTypes.ChatResponse> searchChat(
            @RequestBody RequestTypes.SearchChatRequest request) {
        if (request.question() == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(chatService.searchChat(request));
    }

    @PostMapping("/summarize")
    public ResponseEntity<ResponseTypes.SummarizeResponse> summarize(
            @RequestBody RequestTypes.SummarizeRequest request) {
        if (request.videoId() == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(summarizeService.summarize(request));
    }

    @PostMapping("/research")
    public ResponseEntity<ResponseTypes.ResearchResponse> research(
            @RequestBody RequestTypes.ResearchRequest request) {
        if (request.topic() == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(researchService.research(request));
    }
}
