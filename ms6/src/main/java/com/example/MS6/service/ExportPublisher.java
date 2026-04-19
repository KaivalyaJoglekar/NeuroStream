package com.example.MS6.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Minimal RabbitMQ publisher to broadcast MS6 outputs to MS7 .
 */
@Service
public class ExportPublisher {

    private static final Logger log = LoggerFactory.getLogger(ExportPublisher.class);
    private static final String EXPORT_QUEUE = "pdf_export_queue";

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public ExportPublisher(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    @Bean
    public Queue exportQueue() {
        return new Queue(EXPORT_QUEUE, true); // durable queue
    }

    public void publish(String type, Map<String, Object> payload) {
        try {
            // Include message "type" inside the payload so MS7 knows which builder to invoke
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
