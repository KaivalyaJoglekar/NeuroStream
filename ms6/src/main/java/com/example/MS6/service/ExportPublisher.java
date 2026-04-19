package com.example.MS6.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Publishes MS6 outputs to MS7 for PDF generation.
 *
 * <p>Supports two transport modes controlled by {@code export.transport}:
 * <ul>
 *   <li>{@code http} (default) — fire-and-forget POST directly to MS7's REST API.
 *       No message broker required.</li>
 *   <li>{@code rabbitmq} — publish to a durable RabbitMQ queue that MS7 consumes.</li>
 * </ul>
 */
@Service
public class ExportPublisher {

    private static final Logger log = LoggerFactory.getLogger(ExportPublisher.class);
    private static final String EXPORT_QUEUE = "pdf_export_queue";

    @Autowired(required = false)
    private RabbitTemplate rabbitTemplate;

    private final ObjectMapper objectMapper;
    private final RestClient ms7RestClient;
    private final String transport;

    public ExportPublisher(
            ObjectMapper objectMapper,
            @Value("${export.transport:http}") String transport,
            @Value("${export.ms7-base-url:http://localhost:8007}") String ms7BaseUrl) {
        this.objectMapper = objectMapper;
        this.transport = transport.toLowerCase().trim();
        this.ms7RestClient = RestClient.builder().baseUrl(ms7BaseUrl).build();
        log.info("ExportPublisher transport mode: {}", this.transport);
    }

    @Bean
    @ConditionalOnBean(RabbitTemplate.class)
    public Queue exportQueue() {
        return new Queue(EXPORT_QUEUE, true);
    }

    /**
     * Publish an export payload to MS7.  Always async — never blocks the chat response.
     */
    @Async
    public void publish(String type, Map<String, Object> payload) {
        if ("rabbitmq".equals(transport)) {
            publishViaRabbitMq(type, payload);
        } else {
            publishViaHttp(type, payload);
        }
    }

    // ── HTTP transport (default) ────────────────────────────────────────────────

    private void publishViaHttp(String type, Map<String, Object> payload) {
        String endpoint = switch (type) {
            case "chat" -> "/api/v1/export/chat";
            case "summarize" -> "/api/v1/export/summarize";
            case "research" -> "/api/v1/export/research";
            default -> {
                log.warn("Unknown export type for HTTP transport: {}", type);
                yield null;
            }
        };

        if (endpoint == null) return;

        try {
            String json = objectMapper.writeValueAsString(payload);
            ms7RestClient.post()
                    .uri(endpoint)
                    .header("Content-Type", "application/json")
                    .body(json)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Sent MS6 output [{}] to MS7 via HTTP POST {}", type, endpoint);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize export payload for HTTP", e);
        } catch (Exception e) {
            log.warn("Failed to send export to MS7 via HTTP — is MS7 running? {}", e.getMessage());
        }
    }

    // ── RabbitMQ transport (opt-in) ─────────────────────────────────────────────

    private void publishViaRabbitMq(String type, Map<String, Object> payload) {
        if (rabbitTemplate == null) {
            log.warn("RabbitMQ transport selected but RabbitTemplate is not available. "
                    + "Set EXCLUDE_RABBIT to empty or configure RabbitMQ. Skipping export.");
            return;
        }
        try {
            payload.put("export_type", type);
            String json = objectMapper.writeValueAsString(payload);
            rabbitTemplate.convertAndSend(EXPORT_QUEUE, json);
            log.info("Sent MS6 output [{}] to RabbitMQ for MS7", type);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize RMQ message", e);
        } catch (Exception e) {
            log.warn("Failed to send RMQ message - is RabbitMQ running?", e);
        }
    }
}
