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
import com.example.excelapp.service.ActivityLogService;

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
    private final ActivityLogService activityLogService;

    @Autowired
    private ExcelService excelService;


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

        // יצירת hash לכל שורה שחסר לה - בזיכרון, לא פונה ל-DB
        for (Recipients r : incoming) {
            if (r.getHashCode() == null || r.getHashCode().isEmpty()) {
                r.setHashCode(r.generateRowHashCode());
            }
        }

        // שאילתה אחת שמביאה בבת אחת את כל הנמענים שכבר קיימים (לפי hash) - במקום
        // שאילתה נפרדת לכל שורה בלולאה, שהייתה הופכת שמירה של רשימה גדולה (מאות
        // שורות, למשל אחרי ייבוא אקסל) לאיטית מאוד (מאות round-trip-ים ל-Neon)
        List<String> hashCodes = incoming.stream()
                .map(Recipients::getHashCode)
                .distinct()
                .toList();
        Map<String, Recipients> existingByHash = recipientRepository.findAllById(hashCodes).stream()
                .collect(Collectors.toMap(Recipients::getHashCode, r -> r));

        List<Recipients> toSave = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Recipients r : incoming) {
            if (!seen.add(r.getHashCode())) continue; // כפילות בתוך אותה בקשה
            Recipients existing = existingByHash.get(r.getHashCode());
            if (existing != null) {
                // A row that carries an existing hashCode is an edit, not a duplicate.
                // Preserve the accumulated "belongs to" values while applying all other edits.
                r.setBelongsTo(mergeBelongsTo(existing.getBelongsTo(), r.getBelongsTo()));
            }
            toSave.add(r);
        }
        List<Recipients> savedRecipients = toSave.isEmpty()
                ? List.of()
                : recipientRepository.saveAll(toSave);

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

        activityLogService.log(request.getPhone(), "RECIPIENTS_IMPORTED", "Recipient rows imported: " + request.getRecipients().size());


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

        activityLogService.log(request.getPhone(), "RECIPIENTS_DELETED", "Recipient links removed: " + linksToDelete.size());

        return ResponseEntity.ok().build();
    }
}
