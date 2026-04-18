package com.example.MS6.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "service", "neurostream-ms6",
                "status", "ok",
                "agents", List.of(
                        "retriever", "analyzer", "synthesizer",
                        "citation-linker", "planner", "summarizer")
        );
    }
}
