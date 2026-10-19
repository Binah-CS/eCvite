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
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.mockito.Mockito;
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
    // SpyBean ולא Autowired - עובד בדיוק כמו ה-JdbcTemplate האמיתי, אבל אפשר לספור כמה
    // פקודות SQL הקוד שלח דרכו (המחיקה והקישורים עוברים ב-JDBC ישירות, ולכן הסטטיסטיקה
    // של Hibernate לא רואה אותם - ר' jdbcUpdatesStartingWith)
    @SpyBean
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private EntityManagerFactory entityManagerFactory;
    @PersistenceContext
    private EntityManager entityManager;

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
    void save_sameRecipientSavedRepeatedly_staysLinkedExactlyOnce() throws Exception {
        // הקישור נמען<->משתמשת נוצר עם NOT EXISTS בתוך פקודת ההכנסה (בלי שאילתה
        // נפרדת מראש) - שמירה חוזרת של אותו נמען, גם כקיים (עם hashCode) וגם כשורה
        // "חדשה" עם אותה זהות, לא אמורה ליצור קישור כפול
        User user = seedUser("0531212121", "חוזרת");

        SaveRecipientsRequest first = new SaveRecipientsRequest();
        first.setPhone(user.getPhone());
        first.setRecipients(List.of(newUnsavedRecipient("קבוע", "0532323232")));
        JsonNode saved = objectMapper.readTree(postSave(first)).get(0);

        Recipients asExisting = objectMapper.treeToValue(saved, Recipients.class);
        asExisting.setCity("עיר אחרת");
        SaveRecipientsRequest second = new SaveRecipientsRequest();
        second.setPhone(user.getPhone());
        second.setRecipients(List.of(asExisting));
        postSave(second);

        SaveRecipientsRequest third = new SaveRecipientsRequest();
        third.setPhone(user.getPhone());
        third.setRecipients(List.of(newUnsavedRecipient("קבוע", "0532323232")));
        postSave(third);

        Integer links = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_recipients WHERE user_id = ? AND recipient_id = ?",
                Integer.class, user.getHashCode(), saved.get("hashCode").asText());
        assertThat(links).isEqualTo(1);
    }

    @Test
    void save_printFlag_isPerUser_andDoesNotChangeOtherUsers() throws Exception {
        // הווי "הדפסה" שייך לקישור של כל משתמשת (user_recipients.print), לא לנמען
        // המשותף - משתמשת אחת שמורידה אותו לא מורידה אותו לשנייה
        User userA = seedUser("0536161616", "מדפיסה");
        User userB = seedUser("0536262626", "שותפה");

        Recipients first = newUnsavedRecipient("משותף", "0536363636");
        first.setPrint(true);
        SaveRecipientsRequest saveA = new SaveRecipientsRequest();
        saveA.setPhone(userA.getPhone());
        saveA.setRecipients(List.of(first));
        String hash = objectMapper.readTree(postSave(saveA)).get(0).get("hashCode").asText();

        Recipients same = newUnsavedRecipient("משותף", "0536363636");
        same.setPrint(true);
        SaveRecipientsRequest saveB = new SaveRecipientsRequest();
        saveB.setPhone(userB.getPhone());
        saveB.setRecipients(List.of(same));
        postSave(saveB);
        entityManager.flush();
        entityManager.clear();

        // A מורידה את הווי
        Recipients edited = recipientsRepository.findById(hash).orElseThrow();
        entityManager.detach(edited);
        edited.setPrint(false);
        SaveRecipientsRequest uncheck = new SaveRecipientsRequest();
        uncheck.setPhone(userA.getPhone());
        uncheck.setRecipients(List.of(edited));
        postSave(uncheck);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/api/recipients").param("phone", userA.getPhone()))
                .andExpect(jsonPath("$[0].print").value(false));
        mockMvc.perform(get("/api/recipients").param("phone", userB.getPhone()))
                .andExpect(jsonPath("$[0].print").value(true));
        Boolean storedForA = jdbcTemplate.queryForObject(
                "SELECT print FROM user_recipients WHERE user_id = ? AND recipient_id = ?",
                Boolean.class, userA.getHashCode(), hash);
        Boolean storedForB = jdbcTemplate.queryForObject(
                "SELECT print FROM user_recipients WHERE user_id = ? AND recipient_id = ?",
                Boolean.class, userB.getHashCode(), hash);
        assertThat(storedForA).isFalse();
        assertThat(storedForB).isTrue();
    }

    @Test
    void getRecipients_oldLinkWithoutPrintValue_fallsBackToRecipientValue() throws Exception {
        // קישור שנוצר לפני המעבר (print = null) - מוצג הערך הישן מהנמען, לא נאבד
        User user = seedUser("0536464646", "ותיקה");
        Recipients r = newUnsavedRecipient("ישן", "0536565656");
        r.setPrint(true);
        r.setHashCode(r.generateRowHashCode());
        recipientsRepository.save(r);
        UserRecipients link = new UserRecipients();
        link.setUser(user);
        link.setRecipient(r);
        userRecipientsRepository.save(link);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(jsonPath("$[0].print").value(true));
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

    // ---------- ביצועים: מספר הפקודות ל-DB בשמירה גדולה ----------

    // כמה פקודות SQL ש-Hibernate הכין בפועל מאז ה-clear האחרון (batch של INSERT-ים
    // נספר פעם אחת, לא לכל שורה). המחיקה והקישורים ל-user_recipients עוברים ב-JDBC
    // ישירות ולא נספרים כאן - בשבילם יש jdbcUpdatesStartingWith
    private long preparedStatementsSince(Runnable action) {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        action.run();
        return stats.getPrepareStatementCount();
    }

    // כמה פקודות jdbcTemplate.update שמתחילות בטקסט הזה נשלחו מאז ה-clear האחרון - כדי
    // שבדיקות הביצועים יתפסו גם מחיקה/קישור שחזרו להיות פקודה לכל שורה. נספרת רק
    // הגרסה update(String, Object...) שהקוד קורא לה - בתוכה JdbcTemplate קורא לעוד
    // update פנימי, וה-spy רושם גם אותו, למרות שזו אותה פקודה אחת ל-DB
    private long jdbcUpdatesStartingWith(String sqlPrefix) {
        return Mockito.mockingDetails(jdbcTemplate).getInvocations().stream()
                .filter(inv -> inv.getMethod().getName().equals("update"))
                .filter(inv -> inv.getMethod().getParameterCount() == 2
                        && inv.getMethod().getParameterTypes()[1] == Object[].class)
                .filter(inv -> inv.getArguments().length > 0
                        && inv.getArguments()[0] instanceof String sql
                        && sql.startsWith(sqlPrefix))
                .count();
    }

    private String postSave(SaveRecipientsRequest req) {
        try {
            return mockMvc.perform(post("/api/recipients/save")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsBytes(req)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void save_500NewRows_usesAHandfulOfStatementsNotOnePerRow() throws Exception {
        // לפני התיקון: SELECT לכל שורה (merge) + INSERT לכל שורה + INSERT לכל קישור
        // = כ-1,500 פקודות, כל אחת round-trip נפרד ל-Neon
        User user = seedUser("0526666666", "גדולה");
        List<Recipients> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 500; i++) {
            rows.add(newUnsavedRecipient("נמען" + i, "05" + String.format("%08d", i)));
        }
        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setRecipients(rows);

        String[] response = new String[1];
        Mockito.clearInvocations(jdbcTemplate);
        long statements = preparedStatementsSince(() -> response[0] = postSave(req));

        assertThat(objectMapper.readTree(response[0])).hasSize(500);
        assertThat(statements).isLessThan(40);
        // כל 500 הקישורים למשתמשת - פקודת INSERT אחת, לא אחת לכל נמען
        assertThat(jdbcUpdatesStartingWith("INSERT INTO user_recipients")).isEqualTo(1);

        entityManager.clear();
        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(jsonPath("$", hasSize(500)));
    }

    @Test
    void save_500ExistingRows_updatesWithoutASelectPerRow() throws Exception {
        // השמירה הרגילה אחרי עריכה - כל השורות כבר עם hashCode, אחת מהן השתנתה
        User user = seedUser("0527777777", "עורכת גדולה");
        List<Recipients> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 500; i++) {
            rows.add(newUnsavedRecipient("קיים" + i, "05" + String.format("%08d", i)));
        }
        SaveRecipientsRequest first = new SaveRecipientsRequest();
        first.setPhone(user.getPhone());
        first.setRecipients(rows);
        JsonNode saved = objectMapper.readTree(postSave(first));
        entityManager.flush();
        entityManager.clear();

        List<Recipients> resend = new java.util.ArrayList<>();
        for (JsonNode node : saved) {
            resend.add(objectMapper.treeToValue(node, Recipients.class));
        }
        resend.get(0).setCity("עיר חדשה");
        SaveRecipientsRequest second = new SaveRecipientsRequest();
        second.setPhone(user.getPhone());
        second.setRecipients(resend);

        long statements = preparedStatementsSince(() -> postSave(second));
        assertThat(statements).isLessThan(40);

        entityManager.flush();
        entityManager.clear();
        Recipients edited = recipientsRepository.findById(resend.get(0).getHashCode()).orElseThrow();
        assertThat(edited.getCity()).isEqualTo("עיר חדשה");
        mockMvc.perform(get("/api/recipients").param("phone", user.getPhone()))
                .andExpect(jsonPath("$", hasSize(500)));
    }

    @Test
    void save_deleting300Links_usesOneStatementNotOnePerRow() throws Exception {
        // לפני התיקון: טעינת כל קישור למחיקה + ה-recipient שלו (ManyToOne eager) בשאילתה
        // נפרדת לכל אחד - 585 מחיקות לקחו כמעט 2 דקות מול Neon
        User user = seedUser("0534545454", "מוחקת");
        User other = seedUser("0535656565", "שכנה");
        List<String> toDelete = new java.util.ArrayList<>();
        for (int i = 0; i < 300; i++) {
            toDelete.add(seedRecipientLinkedTo(user, "נמחק" + i, "05" + String.format("%08d", 50000 + i)).getHashCode());
        }
        // נמען שמקושר גם למשתמשת אחרת - המחיקה מנתקת רק את הקישור של המוחקת
        Recipients shared = recipientsRepository.findById(toDelete.get(0)).orElseThrow();
        UserRecipients otherLink = new UserRecipients();
        otherLink.setUser(other);
        otherLink.setRecipient(shared);
        userRecipientsRepository.save(otherLink);
        entityManager.flush();
        entityManager.clear();

        SaveRecipientsRequest req = new SaveRecipientsRequest();
        req.setPhone(user.getPhone());
        req.setRecipients(List.of());
        req.setHashCodesToDelete(toDelete);

        Mockito.clearInvocations(jdbcTemplate);
        long statements = preparedStatementsSince(() -> postSave(req));
        assertThat(statements).isLessThan(10);
        // כל 300 המחיקות - פקודת DELETE אחת, לא אחת לכל שורה
        assertThat(jdbcUpdatesStartingWith("DELETE FROM user_recipients")).isEqualTo(1);

        Integer userLinks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_recipients WHERE user_id = ?", Integer.class, user.getHashCode());
        Integer otherLinks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_recipients WHERE user_id = ?", Integer.class, other.getHashCode());
        assertThat(userLinks).isZero();
        assertThat(otherLinks).isEqualTo(1);
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
