package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;

    private User buildValidUser(String phone) {
        return User.builder()
                .firstNameMan("יוסי")
                .lastName("כהן")
                .phone(phone)
                .build();
    }

    // ---------- POST /api/auth/register ----------

    @Test
    void register_newPhone_createsUserWithGeneratedHashCode() throws Exception {
        User user = buildValidUser("0501234567");

        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        User created = objectMapper.readValue(response, User.class);
        assertThat(created.getHashCode()).isNotBlank();
        assertThat(userRepository.findByPhone("0501234567")).isNotNull();
    }

    @Test
    void register_phoneAlreadyRegistered_returns400_doesNotCreateDuplicate() throws Exception {
        User first = buildValidUser("0502222222");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(first)))
                .andExpect(status().isOk());

        User second = buildValidUser("0502222222");
        second.setFirstNameMan("מישהו אחר");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(second)))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findAll()).hasSize(1);
    }

    @Test
    void register_invalidPhoneFormat_rejectedByValidation() throws Exception {
        // @Pattern על phone ב-User.java דורש בדיוק 10 ספרות
        User user = buildValidUser("123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(user)))
                .andExpect(status().isBadRequest());
    }

    // ---------- POST /api/auth/login ----------

    @Test
    void login_matchingNameAndPhone_returnsUser() throws Exception {
        User user = buildValidUser("0503333333");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(user)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("name", "יוסי", "phone", "0503333333"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("0503333333"));
    }

    @Test
    void login_unknownPhone_returns404() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("name", "מישהי", "phone", "0599999999"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void login_missingNameOrPhone_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("name", "יוסי"))))
                .andExpect(status().isBadRequest());
    }

    // ---------- PUT /api/auth/column-preferences ----------

    @Test
    void updateColumnPreferences_knownUser_savesAndReturnsUpdatedValue() throws Exception {
        User user = buildValidUser("0504444444");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(user)))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/auth/column-preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of(
                                "phone", "0504444444",
                                "columnPreferences", "{\"city\":{\"show\":false}}"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columnPreferences").value("{\"city\":{\"show\":false}}"));

        assertThat(userRepository.findByPhone("0504444444").getColumnPreferences())
                .isEqualTo("{\"city\":{\"show\":false}}");
    }

    @Test
    void updateColumnPreferences_unknownPhone_returns404() throws Exception {
        mockMvc.perform(put("/api/auth/column-preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of(
                                "phone", "0590000002", "columnPreferences", "{}"))))
                .andExpect(status().isNotFound());
    }
}
