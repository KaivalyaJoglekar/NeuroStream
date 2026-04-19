package com.example.MS6;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class Ms6Application {

	public static void main(String[] args) {
		SpringApplication.run(Ms6Application.class, args);
	}

}
