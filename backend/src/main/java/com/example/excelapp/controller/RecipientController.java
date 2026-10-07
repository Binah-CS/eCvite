package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.entity.Recipients;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.dto.SaveRecipientsRequest;
import com.example.excelapp.dto.DeleteRecipientsRequest;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.ExcelService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    @Autowired
    private ExcelService excelService;


    public RecipientController(
            RecipientsRepository recipientRepository,
            UserRecipientsRepository userRecipientsRepository,
            UserRepository userRepository
    ) {
        this.recipientRepository = recipientRepository;
        this.userRecipientsRepository = userRecipientsRepository;
        this.userRepository = userRepository;
    }


    @PostMapping("/save")
    public ResponseEntity<?> saveRecipients(
            @RequestBody SaveRecipientsRequest request
    ) {

        User user = userRepository.findByPhone(request.getPhone());

        System.out.println("SAVE RECIPIENTS START - PHONE: " + request.getPhone()
                + " COUNT: " + request.getRecipients().size());

        if (user == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }

        List<Recipients> incoming = request.getRecipients();

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

        List<Recipients> savedRecipients = new ArrayList<>();

        // עדכון ישיר של נמענים קיימים (לפי ה-hashCode שהם כבר מזוהים איתו) - save()
        // על ישות עם @Id שכבר מוגדר מבצע UPDATE על השורה הקיימת, לא יוצר כפילות
        if (!existingRows.isEmpty()) {
            savedRecipients.addAll(recipientRepository.saveAll(existingRows));
        }

        if (!newRows.isEmpty()) {
            // יצירת hash לכל שורה חדשה - בזיכרון, לא פונה ל-DB
            for (Recipients r : newRows) {
                r.setHashCode(r.generateRowHashCode());
            }

            // צריך לדעת אילו מהשורות האלה כבר קיימות ב-DB (לפי אותו hash) - לא כדי
            // להתעלם מהחדשות (כמו קודם), אלא כדי לאחד את "שייך ל" איתן לפני השמירה
            List<String> hashCodes = newRows.stream().map(Recipients::getHashCode).distinct().toList();
            Map<String, Recipients> existingByHash = recipientRepository.findAllById(hashCodes).stream()
                    .collect(Collectors.toMap(Recipients::getHashCode, r -> r));

            // דה-דופ רק בתוך אותה בקשה (למשל קובץ אקסל עם שתי שורות זהות) - לא מול מה
            // שכבר קיים ב-DB. saveAll() עם hashCode (שהוא ה-@Id, מוגדר-מראש) מבצע
            // עדכון-או-הוספה אוטומטית: אם כבר יש נמען עם אותה זהות (שם+טלפון+כתובת),
            // השורה החדשה בכוונה מעדכנת אותו עם הנתונים הנוכחיים - לא מתעלמת מהם
            // ומחזירה את הישן (כמו שקרה קודם, למשל אחרי מחיקה וייבוא מחדש של אותה זהות).
            // "שייך ל" הוא יוצא דופן - הוא תמיד מצטבר מול מה שכבר היה (לא נדרס), כדי
            // שאותו נמען שמיובא פעם עם שיוך אחד ופעם עם שיוך אחר (שני קבצים/ייבואים
            // נפרדים) יצבור את שניהם ולא יאבד את הקודם
            List<Recipients> toSave = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (Recipients r : newRows) {
                if (!seen.add(r.getHashCode())) continue;
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

        // מחזירים את הנתונים המעודכנים בפועל (כולל hashCode טרי לנמענים חדשים, ו"שייך
        // ל" אחרי איחוד) - כדי שהפרונט יוכל לעדכן את הטבלה מיד מהתשובה הזו, בלי לבקש
        // מחדש את כל הרשימה מהשרת בנפרד (בקשה שלישית שהאיטה את "שמור" בפועל)
        return ResponseEntity.ok(savedRecipients);
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


        return ResponseEntity.ok(
                savedRecipients
        );
    }


    @PostMapping("/delete")
    public ResponseEntity<?> deleteRecipients(
            @RequestBody DeleteRecipientsRequest request
    ) {

        User user = userRepository.findByPhone(request.getPhone());

        if (user == null) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }

        List<String> hashCodes = request.getHashCodes();

        // מוחקים רק את הקישור (user_recipients) בין המשתמש הזה לנמענים שנבחרו -
        // לא את שורת ה-Recipients עצמה, כי אותו hashCode (נגזר משם+טלפון) יכול
        // להיות משותף/מקושר גם למשתמשים אחרים, ומחיקה ישירה הייתה מוחקת להם בטעות.
        // שאילתה אחת ממוקדת (JOIN + IN) - לא טוענים את כל הקישורים של המשתמש
        // (יכולים להיות מאות) רק כדי לסנן בזיכרון בשביל כמה שנבחרו למחיקה
        List<UserRecipients> linksToDelete =
                userRecipientsRepository.findByUserAndRecipient_HashCodeIn(user, hashCodes);

        userRecipientsRepository.deleteAll(linksToDelete);

        return ResponseEntity.ok().build();
    }
}