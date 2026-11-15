package com.example.excelapp.controller;

import com.example.excelapp.dto.AccountResponse;
import com.example.excelapp.dto.UpdateAccountRequest;
import com.example.excelapp.entity.User;
import com.example.excelapp.service.UserService;
import com.example.excelapp.util.AccountValidation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

// עמוד "פרטי חשבון" - קריאה ועדכון של הפרטים שהמשתמשת הזינה בהרשמה ושל פרטי
// השולח שלה למעטפות
@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/account")
    public ResponseEntity<AccountResponse> getAccount(@RequestParam String phone, @RequestParam String hashCode) {
        return userService.findAccount(phone, hashCode)
                .map(user -> ResponseEntity.ok(toResponse(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    // מחזירה 400 עם { errors: { שדה: הודעה }, senderErrors: { שדה: הודעה } } כשיש שדה
    // לא תקין או שדה שאסור לעדכן - ובמקרה כזה שום דבר לא נשמר, גם לא החלקים התקינים
    @PutMapping("/account")
    public ResponseEntity<?> updateAccount(@RequestBody UpdateAccountRequest request) {
        if (request.getPhone() == null || request.getHashCode() == null
                || (request.getAccount() == null && request.getSender() == null)) {
            return ResponseEntity.badRequest().build();
        }

        Optional<User> user = userService.findAccount(request.getPhone(), request.getHashCode());
        if (user.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, String> account = request.getAccount() == null ? Map.of() : request.getAccount();
        Map<String, String> sender = request.getSender();

        Map<String, String> errors = AccountValidation.validateAccount(account);
        Map<String, String> senderErrors = sender == null ? Map.of() : AccountValidation.validateSender(sender);
        if (!errors.isEmpty() || !senderErrors.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("errors", errors, "senderErrors", senderErrors));
        }

        User saved = userService.updateAccount(user.get(), account, sender);
        return ResponseEntity.ok(toResponse(saved));
    }

    private AccountResponse toResponse(User user) {
        return AccountResponse.of(user, userService.findOwnSender(user).orElse(null));
    }
}
