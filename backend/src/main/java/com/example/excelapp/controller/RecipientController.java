package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.entity.Recipients;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.dto.SaveRecipientsRequest;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.ExcelService;
import com.example.excelapp.service.ActivityLogService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recipients")
public class RecipientController {

    private final RecipientsRepository recipientRepository;
    private final UserRecipientsRepository userRecipientsRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;

    @Autowired
    private ExcelService excelService;

    @PersistenceContext
    private EntityManager entityManager;

    // "מציגה" למסד הנתונים מי המשתמשת המבצעת את הפעולה הנוכחית, כדי שהטריגרים
    // ששומרים היסטוריית שינויים בטבלת הנמענים (recipients_history) ידעו למי לייחס
    // כל שינוי/מחיקה - חייבת לרוץ באותה טרנזקציה (@Transactional) של הפעולה עצמה,
    // אחרת ה-DB "ישכח" את זה לפני שהשמירה/מחיקה בפועל קורית
    private void stampCurrentUserForHistory(String userIdentity) {
        entityManager
                .createNativeQuery("SELECT set_config('app.current_user', :val, true)")
                .setParameter("val", userIdentity)
                .getSingleResult();
    }

    public RecipientController(
            RecipientsRepository recipientRepository,
            UserRecipientsRepository userRecipientsRepository,
            UserRepository userRepository,
            ActivityLogService activityLogService
    ) {
        this.recipientRepository = recipientRepository;
        this.userRecipientsRepository = userRecipientsRepository;
        this.userRepository = userRepository;
        this.activityLogService = activityLogService;
    }


    @PostMapping("/save")
    @Transactional
    public ResponseEntity<?> saveRecipients(
            @RequestBody SaveRecipientsRequest request
    ) {

        User user = userRepository.findByPhone(request.getPhone());

        // recipients יכול להיות null בבקשת "מחיקה בלבד" (hashCodesToDelete בלי שורות
        // לשמירה) - לא ניגשים ל-size()/ללולאה על ה-request הגולמי לפני שמוודאים את זה
        List<Recipients> incoming = request.getRecipients() != null
                ? request.getRecipients()
                : new ArrayList<>();

        System.out.println("SAVE RECIPIENTS START - PHONE: " + request.getPhone()
                + " COUNT: " + incoming.size());

        if (user == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }

        stampCurrentUserForHistory(user.getHashCode());

        // מוחקים (מנתקים) קודם, לפני השמירה - לא אחריה. אם המחיקה הייתה רצה אחרי
        // השמירה, נמען שנמחק ואז יובא/נוסף מחדש עם אותה זהות היה מקבל hash זהה לנמען
        // הישן שעדיין מקושר אליך באותו רגע, והמחיקה שרצה רק אחר כך הייתה מנתקת
        // בטעות גם את מה שכרגע נשמר. באותה בקשה/טרנזקציה של השמירה עצמה (לא בקשת
        // HTTP נפרדת) - חוסך round-trip שלם לשרת בכל שמירה שכוללת גם מחיקה
        List<String> hashCodesToDelete = request.getHashCodesToDelete();
        if (hashCodesToDelete != null && !hashCodesToDelete.isEmpty()) {
            deleteUserRecipientLinks(user, hashCodesToDelete);
        }

        // Rows that already have a hashCode are persisted records.  Preserve that
        // stable identity so edits to identity fields do not create a new recipient.
        List<Recipients> existingRows = new ArrayList<>();
        List<Recipients> newRows = new ArrayList<>();
        for (Recipients r : incoming) {
            if (r.getHashCode() == null || r.getHashCode().isEmpty()) {
                newRows.add(r);
            } else {
                existingRows.add(r);
            }
        }

        List<Recipients> savedRecipients = new ArrayList<>();

        if (!existingRows.isEmpty()) {
            savedRecipients.addAll(recipientRepository.saveAll(existingRows));
        }

        if (!newRows.isEmpty()) {
            for (Recipients r : newRows) {
                r.setHashCode(r.generateRowHashCode());
            }

            List<String> hashCodes = newRows.stream()
                    .map(Recipients::getHashCode)
                    .distinct()
                    .toList();
            Map<String, Recipients> existingByHash = recipientRepository.findAllById(hashCodes).stream()
                    .collect(Collectors.toMap(Recipients::getHashCode, r -> r));

            List<Recipients> toSave = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (Recipients r : newRows) {
                if (!seen.add(r.getHashCode())) {
                    continue;
                }
                Recipients existing = existingByHash.get(r.getHashCode());
                if (existing != null) {
                    r.setBelongsTo(mergeBelongsTo(existing.getBelongsTo(), r.getBelongsTo()));
                }
                toSave.add(r);
            }
            savedRecipients.addAll(recipientRepository.saveAll(toSave));
        }

        // שאילתה אחת שמביאה רק את ה-hash-ים הקיימים (לא את הישויות המלאות - זה היה
        // גורם ל-N+1 שאילתות, אחת לכל recipient בנפרד, כי ManyToOne ברירת מחדל הוא eager)
        Set<String> alreadyLinkedHashes = new HashSet<>(
                userRecipientsRepository.findRecipientHashCodesByUser(user)
        );

        List<UserRecipients> links = savedRecipients.stream()
                .filter(recipient -> !alreadyLinkedHashes.contains(recipient.getHashCode()))
                .map(recipient -> {

                    UserRecipients link = new UserRecipients();

                    link.setUser(user);
                    link.setRecipient(recipient);

                    return link;

                })
                .toList();

        if (!links.isEmpty()) {
            userRecipientsRepository.saveAll(links);
        }

        activityLogService.log(request.getPhone(), "RECIPIENTS_SAVED", "Recipient rows submitted: " + incoming.size());

        return ResponseEntity.ok(savedRecipients);
    }

    private String mergeBelongsTo(String existing, String incoming) {
        Set<String> values = new LinkedHashSet<>();
        for (String value : (existing == null ? "" : existing).split(",")) {
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) values.add(trimmed);
        }
        for (String value : (incoming == null ? "" : incoming).split(",")) {
            String trimmed = value.trim();
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

        List<Recipients> recipients = userRecipientsRepository.findByUser(user).stream()
                .map(UserRecipients::getRecipient)
                .toList();

        return ResponseEntity.ok(recipients);
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

        activityLogService.log(request.getPhone(), "RECIPIENTS_IMPORTED", "Recipient rows imported: " + request.getRecipients().size());


        return ResponseEntity.ok(
                savedRecipients
        );
    }


    // מוחקת רק את הקישור (user_recipients) בין המשתמש הזה לנמענים שנבחרו - לא את
    // שורת ה-Recipients עצמה, כי אותו hashCode (נגזר משם+טלפון+כתובת) יכול להיות
    // משותף/מקושר גם למשתמשים אחרים, ומחיקה ישירה הייתה מוחקת להם בטעות. שאילתה
    // אחת ממוקדת (JOIN + IN) - לא טוענים את כל הקישורים של המשתמש (יכולים להיות
    // מאות) רק כדי לסנן בזיכרון בשביל כמה שנבחרו למחיקה. נקראת מתוך saveRecipients
    // (מחיקה משולבת בבקשת save)
    private void deleteUserRecipientLinks(User user, List<String> hashCodes) {
        List<UserRecipients> linksToDelete =
                userRecipientsRepository.findByUserAndRecipient_HashCodeIn(user, hashCodes);
        userRecipientsRepository.deleteAll(linksToDelete);
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

        activityLogService.log(request.getPhone(), "RECIPIENTS_DELETED", "Recipient links removed: " + linksToDelete.size());

        return ResponseEntity.ok().build();
    }
}
