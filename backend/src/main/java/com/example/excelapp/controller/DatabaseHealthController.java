package com.example.excelapp.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * A lightweight endpoint for an external uptime monitor.
 *
 * The query deliberately reaches the database, so a successful response means
 * the application and its PostgreSQL connection are both available.
 */
@RestController
@RequestMapping("/api/health")
public class DatabaseHealthController {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseHealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/db")
    public ResponseEntity<Map<String, String>> checkDatabase() {
        jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
