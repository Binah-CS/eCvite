package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.BiConsumer;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
private final UserRepository userRepository;
    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<User> login(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String phone = request.get("phone");

        if (name == null || phone == null) {
            return ResponseEntity.badRequest().build();
        }

        User user = authService.findUser(name, phone);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(user);
    }
    @PostMapping("/register")
    public ResponseEntity<User> register(@Valid @RequestBody User user) {

        if (userRepository.findByPhone(user.getPhone()) != null) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(authService.register(user));
    }

    @PutMapping("/column-preferences")
    public ResponseEntity<User> updateColumnPreferences(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String columnPreferences = request.get("columnPreferences");

        User user = userRepository.findByPhone(phone);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        user.setColumnPreferences(columnPreferences);
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    // שומרת את הבחירות האחרונות בחלון "הדפסת מדבקות" - ר' User.labelPrintSettings.
    // לא לבלבל עם דגל ההדפסה של כל נמען (UserRecipients.print)
    @PutMapping("/label-print-settings")
    public ResponseEntity<User> updateLabelPrintSettings(@RequestBody Map<String, String> request) {
        return updatePrintSettings(request, "labelPrintSettings", 1000, User::setLabelPrintSettings);
    }

    // אותו דבר לחלון "הדפסת מעטפות" - ר' User.envelopePrintSettings
    @PutMapping("/envelope-print-settings")
    public ResponseEntity<User> updateEnvelopePrintSettings(@RequestBody Map<String, String> request) {
        return updatePrintSettings(request, "envelopePrintSettings", 2000, User::setEnvelopePrintSettings);
    }

    // משותף לשני סוגי ההדפסה. maxLength - אורך העמודה (ר' User): ערך ארוך יותר היה נכשל
    // רק בשמירה ל-DB ומחזיר 500 כללי; כאן הוא נדחה מראש כבקשה לא תקינה
    private ResponseEntity<User> updatePrintSettings(Map<String, String> request, String key, int maxLength,
                                                     BiConsumer<User, String> setter) {
        String phone = request.get("phone");
        String settings = request.get(key);

        if (settings != null && settings.length() > maxLength) {
            return ResponseEntity.badRequest().build();
        }

        User user = userRepository.findByPhone(phone);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        setter.accept(user, settings);
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

}
