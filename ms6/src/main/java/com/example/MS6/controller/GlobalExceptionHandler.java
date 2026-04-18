package com.example.MS6.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.HttpClientErrorException;

import java.util.Map;

/**
 * Global exception handler.
 * Translates upstream failures into clean JSON error responses.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<Map<String, String>> handleUpstreamUnavailable(ResourceAccessException e) {
        log.error("Upstream service unreachable: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Upstream service (MS3) is unavailable. Try again later."));
    }

    @ExceptionHandler(HttpClientErrorException.NotFound.class)
    public ResponseEntity<Map<String, String>> handleNotFound(HttpClientErrorException.NotFound e) {
        log.warn("Upstream resource not found: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Requested video not found or not yet indexed."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException e) {
        log.error("Internal error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An internal error occurred: " + e.getMessage()));
    }
}
