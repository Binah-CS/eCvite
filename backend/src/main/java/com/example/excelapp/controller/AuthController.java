package com.example.excelapp.controller;

import com.example.excelapp.entity.User;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
    // לא לבלבל עם /api/recipients/print-preferences (האם להדפיס כל נמען)
    @PutMapping("/label-print-settings")
    public ResponseEntity<User> updateLabelPrintSettings(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String labelPrintSettings = request.get("labelPrintSettings");

        // העמודה מוגבלת ל-1,000 תווים (ר' User.labelPrintSettings) - ערך ארוך יותר היה נכשל
        // רק בשמירה ל-DB ומחזיר 500 כללי; כאן הוא נדחה מראש כבקשה לא תקינה
        if (labelPrintSettings != null && labelPrintSettings.length() > 1000) {
            return ResponseEntity.badRequest().build();
        }

        User user = userRepository.findByPhone(phone);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        user.setLabelPrintSettings(labelPrintSettings);
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

}
