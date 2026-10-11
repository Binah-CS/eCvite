package com.example.excelapp.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DatabaseHealthController.class)
class DatabaseHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @Test
    void returnsOkOnlyAfterQueryingTheDatabase() throws Exception {
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);

        mockMvc.perform(get("/api/health/db"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        verify(jdbcTemplate).queryForObject("SELECT 1", Integer.class);
    }
}
