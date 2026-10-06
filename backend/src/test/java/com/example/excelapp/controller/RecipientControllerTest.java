package com.example.excelapp.controller;

import com.example.excelapp.dto.SaveRecipientsRequest;
import com.example.excelapp.entity.Recipients;
import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// @Transactional על בדיקת Spring עוטפת כל מתודת @Test בטרנזקציה אחת שמתבטלת
// (rollback) אוטומטית בסופה - כל בדיקה מתחילה ממסד נתונים נקי בלי לנקות ידנית
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RecipientControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RecipientsRepository recipientsRepository;
    @Autowired
    private UserRecipientsRepository userRecipientsRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User seedUser(String phone, String firstNameMan) {
        User user = User.builder()
                .firstNameMan(firstNameMan)
                .lastName("בדיקה")
                .phone(phone)
                .build();
        user.setHashCode(user.generateHashCode());
        return userRepository.save(user);
    }

    private Recipients seedRecipientLinkedTo(User user, String man, String phone) {
        Recipients r = new Recipients();
        r.setMan(man);
        r.setLastName("נמען");
        r.setPhone(phone);
        r.setHashCode(r.generateRowHashCode());
        recipientsRepository.save(r);

        UserRecipients link = new UserRecipients();
        link.setUser(user);
        link.setRecipient(r);
        userRecipientsRepository.save(link);
        return r;
    }

    private Recipients newUnsavedRecipient(String man, String phone) {
        Recipients r = new Recipients();
        r.setMan(man);
        r.setLastName("נמען");
        r.setPhone(phone);
        return r;
    }

    // ---------- POST /api/recipients/save ----------

    @Test
    void save_unknownPhone_returns404() throws Exception {
        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone("0500000000");

        mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    void save_missingRecipientsField_doesNotCrash() throws Exception {
        // זו בדיוק הבקשה שהייתה גורמת ל-NPE לפני התיקון (request.getRecipients().size()
        // לפני בדיקת null) - "מחיקה בלבד", בלי recipients בכלל
        User user = seedUser("0501111111", "דנה");
        Recipients existing = seedRecipientLinkedTo(user, "אבי", "0502222222");

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setHashCodesToDelete(List.of(existing.getHashCode()));
        // req.recipients נשאר null בכוונה

        mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void save_newRecipient_computesHashAndLinksToUser() throws Exception {
        User user = seedUser("0503333333", "נועה");

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setRecipients(List.of(newUnsavedRecipient("יוסי", "0504444444")));

        String response = mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        JsonNode saved = objectMapper.readTree(response).get(0);
        assertThat(saved.get("hashCode").asText()).isNotBlank();

        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].man").value("יוסי"));
    }

    @Test
    void save_keepBothDuplicates_eachGetsDistinctHashAndSaltRoundTrips() throws Exception {
        // זה בדיוק התיקון שעשינו: duplicateSalt היה "הולך לאיבוד" בתשובה מהשרת כי
        // saveAll (merge, לא persist) מחזיר אובייקט בלי שדות @Transient - בלעדי
        // התיקון, saved.get("duplicateSalt") למטה היה יוצא null במקום הערך שנשלח
        User user = seedUser("0505555555", "רון");

        Recipients first = newUnsavedRecipient("משה", "0506666666");
        Recipients second = newUnsavedRecipient("משה", "0506666666"); // אותה זהות בדיוק
        second.setDuplicateSalt("dup-test-123");

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setRecipients(List.of(first, second));

        String response = mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        JsonNode saved = objectMapper.readTree(response);
        String hashA = saved.get(0).get("hashCode").asText();
        String hashB = saved.get(1).get("hashCode").asText();
        assertThat(hashA).isNotEqualTo(hashB);

        JsonNode salted = saved.get(0).get("duplicateSalt").asText("").equals("dup-test-123")
                ? saved.get(0) : saved.get(1);
        assertThat(salted.get("duplicateSalt").asText()).isEqualTo("dup-test-123");
    }

    @Test
    void save_belongsToAccumulates_whenNewRowCollidesWithExistingHash() throws Exception {
        User user = seedUser("0507777777", "גיל");

        Recipients first = newUnsavedRecipient("אלי", "0508888888");
        first.setBelongsTo("חברים");
        SaveRecipientsRequest req1 = new SaveRecipientsRequest();
        req1.setPhone(user.getPhone());
        req1.setRecipients(List.of(first));
        mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req1)))
                .andExpect(status().isOk());

        // אותה זהות בדיוק, בלי hashCode (כאילו יובאה שוב), עם "שייך ל" אחר
        Recipients second = newUnsavedRecipient("אלי", "0508888888");
        second.setBelongsTo("עבודה");
        SaveRecipientsRequest req2 = new SaveRecipientsRequest();
        req2.setPhone(user.getPhone());
        req2.setRecipients(List.of(second));

        String response = mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req2)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        String belongsTo = objectMapper.readTree(response).get(0).get("belongsTo").asText();
        assertThat(belongsTo).contains("חברים").contains("עבודה");
    }

    @Test
    void save_combinedDeleteAndSave_unlinksRecipientInSameRequest() throws Exception {
        User user = seedUser("0509999999", "טל");
        Recipients toDelete = seedRecipientLinkedTo(user, "למחוק", "0501010101");

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setRecipients(List.of());
        req.setHashCodesToDelete(List.of(toDelete.getHashCode()));

        mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void save_existingHashCode_updatesRegardlessOfWhichUserSentIt() throws Exception {
        // פער אבטחה ידוע (לא תוקן, רק מתועד כאן): אין בדיקה שהנמען ששולחים אותו
        // hashCode קיים באמת שייך/מקושר למשתמשת ששולחת את הבקשה. אם זה אי-פעם
        // ייסגר, הבדיקה הזו תפסיק לעבור ותצטרך עדכון - זה בכוונה, לא רגרסיה
        User ownerA = seedUser("0511111111", "בעלים");
        User userB = seedUser("0512222222", "אחר");
        Recipients belongsToA = seedRecipientLinkedTo(ownerA, "מקורי", "0513333333");

        Recipients overwrite = new Recipients();
        overwrite.setHashCode(belongsToA.getHashCode());
        overwrite.setMan("נדרס ע\"י משתמשת אחרת");
        overwrite.setLastName("נמען");
        overwrite.setPhone(belongsToA.getPhone());

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(userB.getPhone()); // לא הבעלים המקוריים
        req.setRecipients(List.of(overwrite));

        mockMvc.perform(post("/api/recipients/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(req)))
                .andExpect(status().isOk());

        Recipients afterUpdate = recipientsRepository.findById(belongsToA.getHashCode()).orElseThrow();
        assertThat(afterUpdate.getMan()).isEqualTo("נדרס ע\"י משתמשת אחרת");
    }

    // ---------- GET /api/recipients ----------

    @Test
    void getRecipients_returnsOnlyRecipientsLinkedToThatUser() throws Exception {
        User userA = seedUser("0514444444", "א");
        User userB = seedUser("0515555555", "ב");
        seedRecipientLinkedTo(userA, "שייך לא", "0516666666");
        seedRecipientLinkedTo(userB, "שייך לב", "0517777777");

        mockMvc.perform(get("/api/recipients").param("phone", userA.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].man").value("שייך לא"));
    }

    @Test
    void getRecipients_unknownPhone_returns404() throws Exception {
        mockMvc.perform(get("/api/recipients").param("phone", "0590000000"))
                .andExpect(status().isNotFound());
    }

    // ---------- GET /api/recipients/{hashCode}/history ----------

    private void insertHistoryRow(String recipientHashCode, String changedBy, String operation) {
        jdbcTemplate.update(
                "INSERT INTO recipients_history (recipient_hash_code, changed_by, change_date, operation, old_data) " +
                        "VALUES (?, ?, ?, ?, ?)",
                recipientHashCode, changedBy, LocalDateTime.now(), operation, "{}"
        );
    }

    @Test
    void history_emptyForRecipientWithNoChanges() throws Exception {
        User user = seedUser("0518888888", "חדשה");
        Recipients recipient = seedRecipientLinkedTo(user, "חדש", "0519999999");

        mockMvc.perform(get("/api/recipients/" + recipient.getHashCode() + "/history")
                        .param("phone", user.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void history_returnsEntriesForLinkedRecipient() throws Exception {
        User user = seedUser("0521111111", "עורכת");
        Recipients recipient = seedRecipientLinkedTo(user, "נערך", "0522222222");
        insertHistoryRow(recipient.getHashCode(), user.getHashCode(), "UPDATE");

        mockMvc.perform(get("/api/recipients/" + recipient.getHashCode() + "/history")
                        .param("phone", user.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].operation").value("UPDATE"))
                .andExpect(jsonPath("$[0].changedByName").value("עורכת"));
    }

    @Test
    void history_hiddenFromUserNotLinkedToTheRecipient() throws Exception {
        // בדיקת ההרשאה (ה-EXISTS בתוך ה-query, ר' ההערה ב-getRecipientHistory) -
        // משתמשת שלא מקושרת לנמען הזה לא אמורה לראות את ההיסטוריה שלו בכלל
        User owner = seedUser("0523333333", "בעלים");
        User stranger = seedUser("0524444444", "זרה");
        Recipients recipient = seedRecipientLinkedTo(owner, "פרטי", "0525555555");
        insertHistoryRow(recipient.getHashCode(), owner.getHashCode(), "UPDATE");

        mockMvc.perform(get("/api/recipients/" + recipient.getHashCode() + "/history")
                        .param("phone", stranger.getPhone()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void history_unknownPhone_returns404() throws Exception {
        mockMvc.perform(get("/api/recipients/someHash/history").param("phone", "0590000001"))
                .andExpect(status().isNotFound());
    }
}
