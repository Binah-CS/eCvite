package com.example.excelapp.controller;

import com.example.excelapp.entity.Recipients;
import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AuthService authService;
    @Autowired
    private RecipientsRepository recipientsRepository;
    @Autowired
    private UserRecipientsRepository userRecipientsRepository;

    private User registerUser(String phone) {
        return authService.register(User.builder()
                .firstNameMan("יוסי")
                .firstNameWoman("רחל")
                .lastName("כהן")
                .phone(phone)
                .email("rachel@gmail.com")
                .city("ירושלים")
                .street("הרצל")
                .houseNumber("5")
                .build());
    }

    private ResultActions putAccount(String phone, String hashCode, Map<String, String> account) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("phone", phone);
        body.put("hashCode", hashCode);
        body.put("account", account);
        return mockMvc.perform(put("/api/user/account")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(body)));
    }

    // ---------- GET /api/user/account ----------

    @Test
    void getAccount_matchingPhoneAndHash_returnsUserAndFieldLists() throws Exception {
        User user = registerUser("0501111111");

        mockMvc.perform(get("/api/user/account")
                        .param("phone", "0501111111")
                        .param("hashCode", user.getHashCode()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.lastName").value("כהן"))
                .andExpect(jsonPath("$.readOnlyFields[0]").value("phone"))
                .andExpect(jsonPath("$.editableFields").isArray())
                .andExpect(jsonPath("$.requiredFields").isArray());
    }

    @Test
    void getAccount_wrongHash_returns404() throws Exception {
        registerUser("0501111112");

        mockMvc.perform(get("/api/user/account")
                        .param("phone", "0501111112")
                        .param("hashCode", "not-the-hash"))
                .andExpect(status().isNotFound());
    }

    // ---------- PUT /api/user/account ----------

    @Test
    void updateAccount_validFields_savesTrimmedValues() throws Exception {
        User user = registerUser("0502222221");

        putAccount("0502222221", user.getHashCode(), Map.of("lastName", "  לוי  ", "city", "בני ברק"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.lastName").value("לוי"))
                .andExpect(jsonPath("$.user.city").value("בני ברק"));

        User saved = userRepository.findByPhone("0502222221");
        assertThat(saved.getLastName()).isEqualTo("לוי");
        assertThat(saved.getCity()).isEqualTo("בני ברק");
        assertThat(saved.getStreet()).isEqualTo("הרצל");
    }

    @Test
    void updateAccount_changingName_keepsHashCodeAndRecipientLinks() throws Exception {
        User user = registerUser("0502222222");
        String originalHash = user.getHashCode();
        Recipients recipient = new Recipients();
        recipient.setHashCode("r-1");
        recipient.setLastName("שמש");
        recipient = recipientsRepository.save(recipient);
        UserRecipients link = new UserRecipients();
        link.setUser(user);
        link.setRecipient(recipient);
        userRecipientsRepository.save(link);

        putAccount("0502222222", originalHash, Map.of("firstNameWoman", "לאה", "lastName", "לוי"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.hashCode").value(originalHash));

        assertThat(userRepository.findByPhone("0502222222").getHashCode()).isEqualTo(originalHash);
        assertThat(userRecipientsRepository.findAll())
                .anyMatch(saved -> saved.getUser().getHashCode().equals(originalHash));
    }

    @Test
    void updateAccount_readOnlyOrUnknownField_returns400_andSavesNothing() throws Exception {
        User user = registerUser("0502222223");

        putAccount("0502222223", user.getHashCode(), Map.of(
                "lastName", "לוי",
                "phone", "0509999999",
                "hashCode", "hacked",
                "firstNameMan", "מישהו"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.phone").exists())
                .andExpect(jsonPath("$.errors.hashCode").exists())
                .andExpect(jsonPath("$.errors.firstNameMan").exists())
                .andExpect(jsonPath("$.errors.lastName").doesNotExist());

        User saved = userRepository.findByPhone("0502222223");
        assertThat(saved.getLastName()).isEqualTo("כהן");
        assertThat(saved.getHashCode()).isEqualTo(user.getHashCode());
        assertThat(saved.getFirstNameMan()).isEqualTo("יוסי");
    }

    @Test
    void updateAccount_invalidValues_returnFieldErrors() throws Exception {
        User user = registerUser("0502222224");

        putAccount("0502222224", user.getHashCode(), Map.of(
                "email", "rachel@yahoo.com",
                "houseNumber", "5ab",
                "lastName", "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.houseNumber").exists())
                .andExpect(jsonPath("$.errors.lastName").exists());

        assertThat(userRepository.findByPhone("0502222224").getEmail()).isEqualTo("rachel@gmail.com");
    }

    @Test
    void updateAccount_emptyOptionalField_isClearedToNull() throws Exception {
        User user = registerUser("0502222225");
        user.setEventType("חתונה");
        userRepository.save(user);

        putAccount("0502222225", user.getHashCode(), Map.of("eventType", ""))
                .andExpect(status().isOk());

        assertThat(userRepository.findByPhone("0502222225").getEventType()).isNull();
    }

    @Test
    void updateAccount_wrongHash_returns404_andSavesNothing() throws Exception {
        registerUser("0502222226");

        putAccount("0502222226", "not-the-hash", Map.of("lastName", "לוי"))
                .andExpect(status().isNotFound());

        assertThat(userRepository.findByPhone("0502222226").getLastName()).isEqualTo("כהן");
    }

    @Test
    void updateAccount_missingAccount_returns400() throws Exception {
        User user = registerUser("0502222227");

        putAccount("0502222227", user.getHashCode(), null)
                .andExpect(status().isBadRequest());
    }
}
