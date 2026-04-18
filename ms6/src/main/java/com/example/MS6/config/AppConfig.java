package com.example.MS6.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class AppConfig {

    @Bean
    public RestClient ms3RestClient(@Value("${ms3.base-url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    @Bean
    public RestClient geminiRestClient() {
        return RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
    }
}
