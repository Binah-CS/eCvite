package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.entity.Recipients;
import com.example.excelapp.entity.RecipientPrintPreference;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.repository.RecipientPrintPreferenceRepository;
import com.example.excelapp.dto.SaveRecipientsRequest;
import com.example.excelapp.dto.UpdatePrintPreferenceRequest;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.ExcelService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recipients")
public class RecipientController {

    private final RecipientsRepository recipientRepository;
    private final UserRecipientsRepository userRecipientsRepository;
    private final UserRepository userRepository;
    private final RecipientPrintPreferenceRepository recipientPrintPreferenceRepository;

    @Autowired
    private ExcelService excelService;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // מוצאת את ה-hash של המשתמשת לפי הטלפון, ובאותה שאילתה גם "מציגה" למסד הנתונים
    // מי המשתמשת המבצעת את הפעולה הנוכחית - כדי שהטריגרים ששומרים היסטוריית שינויים
    // בטבלת הנמענים (recipients_history) ידעו למי לייחס כל שינוי/מחיקה. חייבת לרוץ
    // באותה טרנזקציה (@Transactional) של הפעולה עצמה, אחרת ה-DB "ישכח" את זה לפני
    // שהשמירה/מחיקה בפועל קורית. set_config מחזירה את הערך שהציבה, כלומר את ה-hash
    // עצמו - פנייה אחת ל-DB במקום שתיים (findByPhone ואז set_config בנפרד). אם אין
    // משתמשת עם הטלפון הזה - אין שורות, set_config לא רצה, ומוחזר null
    @SuppressWarnings("unchecked")
    private String findUserHashAndStampForHistory(String phone) {
        List<Object> result = entityManager
                .createNativeQuery("SELECT set_config('app.current_user', u.hash_code, true) FROM users u WHERE u.phone = :phone")
                .setParameter("phone", phone)
                .getResultList();
        return result.isEmpty() ? null : (String) result.get(0);
    }

    public RecipientController(
            RecipientsRepository recipientRepository,
            UserRecipientsRepository userRecipientsRepository,
            UserRepository userRepository,
            RecipientPrintPreferenceRepository recipientPrintPreferenceRepository
    ) {
        this.recipientRepository = recipientRepository;
        this.userRecipientsRepository = userRecipientsRepository;
        this.userRepository = userRepository;
        this.recipientPrintPreferenceRepository = recipientPrintPreferenceRepository;
    }


    @PostMapping("/save")
    @Transactional
    public ResponseEntity<?> saveRecipients(
            @RequestBody SaveRecipientsRequest request
    ) {

        // מציאת המשתמשת ו"הצגתה" לטריגר ההיסטוריה בפנייה אחת ל-DB במקום שתיים (ר'
        // findUserHashAndStampForHistory). לא טוענים את ישות ה-User בכלל - כל מה
        // שהשמירה צריכה (מחיקת קישורים, הוספת קישורים) עובד לפי ה-hash שלה בלבד
        String userHashCode = findUserHashAndStampForHistory(request.getPhone());

        // recipients יכול להיות null בבקשת "מחיקה בלבד" (hashCodesToDelete בלי שורות
        // לשמירה) - לא ניגשים ל-size()/ללולאה על ה-request הגולמי לפני שמוודאים את זה
        List<Recipients> incoming = request.getRecipients() != null
                ? request.getRecipients()
                : new ArrayList<>();

        System.out.println("SAVE RECIPIENTS START - PHONE: " + request.getPhone()
                + " COUNT: " + incoming.size());

        if (userHashCode == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }

        // מוחקים (מנתקים) קודם, לפני השמירה - לא אחריה. אם המחיקה הייתה רצה אחרי
        // השמירה, נמען שנמחק ואז יובא/נוסף מחדש עם אותה זהות היה מקבל hash זהה לנמען
        // הישן שעדיין מקושר אליך באותו רגע, והמחיקה שרצה רק אחר כך הייתה מנתקת
        // בטעות גם את מה שכרגע נשמר. באותה בקשה/טרנזקציה של השמירה עצמה (לא בקשת
        // HTTP נפרדת) - חוסך round-trip שלם לשרת בכל שמירה שכוללת גם מחיקה
        List<String> hashCodesToDelete = request.getHashCodesToDelete();
        if (hashCodesToDelete != null && !hashCodesToDelete.isEmpty()) {
            deleteUserRecipientLinks(userHashCode, hashCodesToDelete);
        }

        // הפרדה לפי מה שהפרונט כבר יודע: שורה עם hashCode היא נמען קיים שמזוהה
        // במפורש - מעדכנים אותה ישירות, בלי לחפש/להשוות לאף נמען אחר (בדיוק השורה
        // שעליה עבדו, לא "מישהו עם אותו שם"). רק שורה בלי hashCode היא נמען חדש
        // לגמרי שצריך hash טרי ובדיקת כפילות מול מה שכבר קיים
        List<Recipients> existingRows = new ArrayList<>();
        List<Recipients> newRows = new ArrayList<>();
        for (Recipients r : incoming) {
            if (r.getHashCode() != null && !r.getHashCode().isEmpty()) {
                existingRows.add(r);
            } else {
                newRows.add(r);
            }
        }

        // יצירת hash לכל שורה חדשה - בזיכרון, לא פונה ל-DB
        for (Recipients r : newRows) {
            r.setHashCode(r.generateRowHashCode());
        }

        // שאילתה אחת שטוענת את כל הנמענים מהבקשה שכבר קיימים ב-DB (גם קיימים וגם
        // "חדשים" שה-hash שלהם כבר קיים). בלי זה, saveAll() על ישות עם @Id מוגדר-מראש
        // עושה merge() שמריץ SELECT נפרד לכל שורה לפני השמירה - ב-500 שורות זה 500
        // round-trips ל-Neon, וזה מה שהפך את "שמור" לאיטי מאוד. ישות שכבר נטענה כאן
        // נמצאת ב-persistence context, וה-merge עליה לא פונה ל-DB בכלל
        // בחלקים של עד 1,000 (forEachChunk), כמו המחיקה וההוספה - שקובץ ענק לא יחרוג
        // ממגבלת מספר הפרמטרים של Postgres בשאילתה אחת
        List<String> requestHashCodes = incoming.stream()
                .map(Recipients::getHashCode)
                .distinct()
                .toList();
        Map<String, Recipients> managedByHash = new HashMap<>();
        forEachChunk(requestHashCodes, (chunk, placeholders) ->
                recipientRepository.findAllById(chunk).forEach(r -> managedByHash.put(r.getHashCode(), r)));

        List<Recipients> savedRecipients = new ArrayList<>();

        // עדכון ישיר של נמענים קיימים (לפי ה-hashCode שהם כבר מזוהים איתו) - UPDATE על
        // השורה הקיימת, לא יוצר כפילות
        for (Recipients r : existingRows) {
            savedRecipients.add(upsertRecipient(r, managedByHash));
        }

        // דה-דופ רק בתוך אותה בקשה (למשל קובץ אקסל עם שתי שורות זהות) - לא מול מה
        // שכבר קיים ב-DB. אם כבר יש נמען עם אותה זהות (שם+טלפון+כתובת), השורה החדשה
        // בכוונה מעדכנת אותו עם הנתונים הנוכחיים - לא מתעלמת מהם ומחזירה את הישן (כמו
        // שקרה קודם, למשל אחרי מחיקה וייבוא מחדש של אותה זהות). "שייך ל" הוא יוצא
        // דופן - הוא תמיד מצטבר מול מה שכבר היה (לא נדרס), כדי שאותו נמען שמיובא פעם
        // עם שיוך אחד ופעם עם שיוך אחר (שני קבצים/ייבואים נפרדים) יצבור את שניהם ולא
        // יאבד את הקודם
        Set<String> seen = new HashSet<>();
        for (Recipients r : newRows) {
            if (!seen.add(r.getHashCode())) continue;
            Recipients existing = managedByHash.get(r.getHashCode());
            if (existing != null) {
                r.setBelongsTo(mergeBelongsTo(existing.getBelongsTo(), r.getBelongsTo()));
            }
            savedRecipients.add(upsertRecipient(r, managedByHash));
        }

        // שולחים עכשיו את כל ה-INSERT/UPDATE של הנמענים (ב-batch-ים, ר'
        // hibernate.jdbc.batch_size) - חייבים לפני הוספת הקישורים למטה, שמפנים אליהם
        entityManager.flush();

        List<String> hashCodesToLink = savedRecipients.stream()
                .map(Recipients::getHashCode)
                .distinct()
                .toList();

        // ישירות ב-JDBC ולא saveAll() - ל-UserRecipients יש id מסוג IDENTITY, ו-Hibernate
        // מבטל batching לגמרי לישויות כאלה (כל קישור היה round-trip נפרד)
        linkRecipientsToUser(userHashCode, hashCodesToLink);

        // save()/saveAll() על ישות עם @Id שכבר מוגדר (המצב תמיד כאן - ה-hash מחושב
        // מראש) מבצע merge(), לא persist() - וה-merge מחזיר אובייקט "רענן" שכולל רק
        // שדות ממופים ל-DB. duplicateSalt הוא @Transient (לא שדה DB בכלל) ולכן נשמט
        // מהאובייקט שחוזר מ-saveAll, גם אם הוא הגיע עם ערך בבקשה המקורית - "מצמידים"
        // אותו בחזרה כאן לפי hashCode, מתוך הבקשה המקורית (incoming), כדי שהפרונט
        // (DashboardPage.jsx, savedByIdentity) יוכל להמשיך להשתמש בו לזיהוי השורה
        Map<String, String> saltByHash = incoming.stream()
                .filter(r -> r.getHashCode() != null && r.getDuplicateSalt() != null)
                .collect(Collectors.toMap(Recipients::getHashCode, Recipients::getDuplicateSalt, (a, b) -> a));
        savedRecipients.forEach(r -> r.setDuplicateSalt(saltByHash.get(r.getHashCode())));

        // מחזירים את הנתונים המעודכנים בפועל (כולל hashCode טרי לנמענים חדשים, ו"שייך
        // ל" אחרי איחוד) - כדי שהפרונט יוכל לעדכן את הטבלה מיד מהתשובה הזו, בלי לבקש
        // מחדש את כל הרשימה מהשרת בנפרד (בקשה שלישית שהאיטה את "שמור" בפועל)
        return ResponseEntity.ok(savedRecipients);
    }

    // נמען שלא קיים ב-DB נשמר עם persist() - בלי ה-SELECT המקדים ש-merge() עושה כדי
    // לבדוק אם הוא קיים (את זה כבר יודעים מ-managedByHash). נמען קיים כבר טעון ב-
    // persistence context, ולכן ה-merge עליו רק מעתיק את הערכים החדשים, בלי פנייה ל-DB
    private Recipients upsertRecipient(Recipients r, Map<String, Recipients> managedByHash) {
        if (!managedByHash.containsKey(r.getHashCode())) {
            entityManager.persist(r);
            managedByHash.put(r.getHashCode(), r);
            return r;
        }
        return entityManager.merge(r);
    }

    // מאחדת ערכי "שייך ל" (מופרדים בפסיק) מהרשומה הקיימת ב-DB ומהשורה שנשלחה עכשיו,
    // בלי כפילויות - ר' ההסבר למעלה למה זה השדה היחיד שמצטבר ולא נדרס
    private String mergeBelongsTo(String existing, String incoming) {
        Set<String> values = new LinkedHashSet<>();
        for (String part : (existing == null ? "" : existing).split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) values.add(trimmed);
        }
        for (String part : (incoming == null ? "" : incoming).split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) values.add(trimmed);
        }
        return String.join(", ", values);
    }


    @GetMapping
    public ResponseEntity<?> getRecipients(@RequestParam String phone) {

        User user = userRepository.findByPhone(phone);

        if (user == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }

        Map<String, Boolean> printPreferences = recipientPrintPreferenceRepository.findByUser(user).stream()
                .collect(Collectors.toMap(
                        preference -> preference.getRecipient().getHashCode(),
                        RecipientPrintPreference::isPrintEnabled,
                        (first, ignored) -> first
                ));

        List<Recipients> recipients = userRecipientsRepository.findByUser(user).stream()
                .map(UserRecipients::getRecipient)
                .peek(recipient -> recipient.setPrintEnabled(
                        printPreferences.getOrDefault(recipient.getHashCode(), true)
                ))
                .toList();

        return ResponseEntity.ok(recipients);
    }

    @PutMapping("/print-preferences")
    @Transactional
    public ResponseEntity<?> updatePrintPreferences(@RequestBody UpdatePrintPreferenceRequest request) {
        User user = userRepository.findByPhone(request.getPhone());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        List<String> requestedHashes = request.getRecipientHashCodes() == null
                ? List.of()
                : request.getRecipientHashCodes().stream()
                        .filter(hash -> hash != null && !hash.isBlank())
                        .distinct()
                        .toList();
        if (requestedHashes.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<UserRecipients> links = userRecipientsRepository
                .findByUserAndRecipient_HashCodeIn(user, requestedHashes);
        Map<String, RecipientPrintPreference> existingPreferences = recipientPrintPreferenceRepository
                .findByUserAndRecipient_HashCodeIn(user, requestedHashes)
                .stream()
                .collect(Collectors.toMap(
                        preference -> preference.getRecipient().getHashCode(),
                        preference -> preference
                ));

        List<RecipientPrintPreference> preferencesToSave = links.stream()
                .map(UserRecipients::getRecipient)
                .map(recipient -> {
                    RecipientPrintPreference preference = existingPreferences.get(recipient.getHashCode());
                    if (preference == null) {
                        preference = new RecipientPrintPreference();
                        preference.setUser(user);
                        preference.setRecipient(recipient);
                    }
                    preference.setPrintEnabled(request.isPrintEnabled());
                    return preference;
                })
                .toList();

        recipientPrintPreferenceRepository.saveAll(preferencesToSave);
        return ResponseEntity.ok(preferencesToSave);
    }



    @PostMapping("/add")
    public ResponseEntity<Recipients> insertRecipient(
            @RequestBody Recipients newRecipient
    ) {

        newRecipient.setHashCode(
                newRecipient.generateRowHashCode()
        );


        Recipients savedRecipient =
                recipientRepository.save(newRecipient);


        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedRecipient);
    }



    @PostMapping("/import")
    public ResponseEntity<?> importRecipients(
            @RequestBody SaveRecipientsRequest request
    ) {

        User user = userRepository.findByPhone(request.getPhone());

        if (user == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }


        List<Recipients> savedRecipients = new ArrayList<>();

        for (Recipients r : request.getRecipients()) {

            // יצירת hash אם חסר
            if (r.getHashCode() == null || r.getHashCode().isEmpty()) {
                r.setHashCode(r.generateRowHashCode());
            }

            // בדיקה האם הנמען כבר קיים - אם כן, משתמשים ברשומה הקיימת ולא דורסים אותה
            // בנתונים חלקיים מהייבוא הנוכחי (אותה בדיקה שיש כבר ב-saveRecipients)
            Recipients existing =
                    recipientRepository.findById(r.getHashCode())
                            .orElse(null);

            if (existing != null) {
                savedRecipients.add(existing);
            } else {
                savedRecipients.add(recipientRepository.save(r));
            }
        }


        // יצירת מצביעים למשתמש - רק לנמענים שעדיין לא מקושרים אליו, כדי לא ליצור קישורים כפולים
        List<UserRecipients> links = savedRecipients.stream()
                .filter(recipient ->
                        !userRecipientsRepository.existsByUserAndRecipient(user, recipient)
                )
                .map(recipient -> {

                    UserRecipients link = new UserRecipients();

                    link.setUser(user);
                    link.setRecipient(recipient);

                    return link;

                })
                .toList();


        userRecipientsRepository.saveAll(links);


        return ResponseEntity.ok(
                savedRecipients
        );
    }


    // מוחקת רק את הקישור (user_recipients) בין המשתמש הזה לנמענים שנבחרו - לא את
    // שורת ה-Recipients עצמה, כי אותו hashCode (נגזר משם+טלפון+כתובת) יכול להיות
    // משותף/מקושר גם למשתמשים אחרים, ומחיקה ישירה הייתה מוחקת להם בטעות. נקראת מתוך
    // saveRecipients (מחיקה משולבת בבקשת save).
    // פקודת DELETE ישירה ולא טעינת ישויות UserRecipients ואז deleteAll() - הטעינה
    // הייתה מביאה לכל קישור גם את ה-recipient שלו (ManyToOne eager) בשאילתה נפרדת,
    // כלומר round-trip ל-Neon לכל שורה שנמחקה: 585 מחיקות לקחו כמעט 2 דקות
    private void deleteUserRecipientLinks(String userHashCode, List<String> hashCodes) {
        forEachChunk(hashCodes, (chunk, placeholders) -> {
            List<Object> params = new ArrayList<>(chunk.size() + 1);
            params.add(userHashCode);
            params.addAll(chunk);
            jdbcTemplate.update(
                    "DELETE FROM user_recipients WHERE user_id = ? AND recipient_id IN (" + placeholders + ")",
                    params.toArray()
            );
        });
    }

    // מקשרת את המשתמשת לכל הנמענים שנשמרו, רק לאלה שעוד לא מקושרים אליה - פקודת
    // INSERT אחת שבוחרת את הנמענים מטבלת recipients (כולם כבר קיימים שם, אחרי ה-flush)
    // ומסננת עם NOT EXISTS את מי שכבר מקושר. לא שאילתה נפרדת מראש של "למי כבר מקושרת",
    // ולא פקודה לכל קישור (batch של מאות פקודות נשלח בכמה round-trips ל-Neon)
    private void linkRecipientsToUser(String userHashCode, List<String> hashCodes) {
        forEachChunk(hashCodes, (chunk, placeholders) -> {
            List<Object> params = new ArrayList<>(chunk.size() + 2);
            params.add(userHashCode);
            params.addAll(chunk);
            params.add(userHashCode);
            jdbcTemplate.update(
                    "INSERT INTO user_recipients (user_id, recipient_id) " +
                            "SELECT ?, r.hash_code FROM recipients r " +
                            "WHERE r.hash_code IN (" + placeholders + ") " +
                            "AND NOT EXISTS (SELECT 1 FROM user_recipients ur " +
                            "WHERE ur.user_id = ? AND ur.recipient_id = r.hash_code)",
                    params.toArray()
            );
        });
    }

    // מריצה פעולה על הרשימה בחלקים של עד 1,000 (עם "?,?,..." מוכן לכל חלק) - כדי
    // שפקודה אחת לא תתקרב למגבלת מספר הפרמטרים של Postgres גם ברשימות גדולות מאוד
    private void forEachChunk(List<String> values, BiConsumer<List<String>, String> action) {
        final int chunkSize = 1000;
        for (int from = 0; from < values.size(); from += chunkSize) {
            List<String> chunk = values.subList(from, Math.min(from + chunkSize, values.size()));
            action.accept(chunk, String.join(",", Collections.nCopies(chunk.size(), "?")));
        }
    }

    // כל ההסטוריה השמורה לנמען ספציפי (recipients_history) - מכל המשתמשות שאי-פעם
    // שינו אותו, לא רק המשתמשת הנוכחית. מחזירה שאילתה גולמית (לא ישות JPA) כדי לא
    // להתעסק עם מיפוי טיפוס jsonb - old_data מוחזר כמחרוזת JSON גולמית, שהפרונט
    // כבר יודע לפרש (JSON.parse), ו"מי שינה" גם כשם תצוגה (לא רק הקוד הטכני)
    @SuppressWarnings("unchecked")
    @GetMapping("/{hashCode}/history")
    public ResponseEntity<?> getRecipientHistory(@PathVariable String hashCode, @RequestParam String phone) {
        User user = userRepository.findByPhone(phone);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        // בדיקת ההרשאה (רק משתמשת שהנמען הזה בפועל ברשימה שלה) משולבת ישירות בתוך
        // השאילתה עצמה (EXISTS על user_recipients) במקום קריאה נפרדת לפני - חוסך
        // round-trip שלם לשרת ה-DB בכל פתיחת היסטוריה. אם אין קישור, השאילתה פשוט
        // לא מחזירה כלום, בדיוק כמו נמען בלי היסטוריה בכלל - לא חושף למי שאין לו
        // הרשאה אם ה-hashCode בכלל קיים
        List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT h.changed_by, h.change_date, h.operation, CAST(h.old_data AS text), " +
                        "COALESCE(NULLIF(u.first_name_man, ''), NULLIF(u.first_name_woman, ''), 'משתמשת לא ידועה') AS changed_by_name " +
                        "FROM recipients_history h " +
                        "LEFT JOIN users u ON u.hash_code = h.changed_by " +
                        "WHERE h.recipient_hash_code = :hashCode " +
                        "AND EXISTS (SELECT 1 FROM user_recipients ur WHERE ur.user_id = :userHashCode AND ur.recipient_id = :hashCode) " +
                        "ORDER BY h.change_date DESC"
        ).setParameter("hashCode", hashCode).setParameter("userHashCode", user.getHashCode()).getResultList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> entry = new java.util.LinkedHashMap<>();
            entry.put("changedBy", row[0]);
            entry.put("changeDate", row[1]);
            entry.put("operation", row[2]);
            entry.put("oldData", row[3]);
            entry.put("changedByName", row[4]);
            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }
}
