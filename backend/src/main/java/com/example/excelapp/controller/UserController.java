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

// עמוד "פרטי חשבון" - קריאה ועדכון של הפרטים שהמשתמשת הזינה בהרשמה
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
                .map(user -> ResponseEntity.ok(AccountResponse.of(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    // מחזירה 400 עם { errors: { שדה: הודעה } } כשיש שדה לא תקין או שדה שאסור לעדכן -
    // ובמקרה כזה שום שדה לא נשמר, גם לא התקינים
    @PutMapping("/account")
    public ResponseEntity<?> updateAccount(@RequestBody UpdateAccountRequest request) {
        if (request.getPhone() == null || request.getHashCode() == null || request.getAccount() == null) {
            return ResponseEntity.badRequest().build();
        }

        Optional<User> user = userService.findAccount(request.getPhone(), request.getHashCode());
        if (user.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, String> errors = AccountValidation.validateAccount(request.getAccount());
        if (!errors.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("errors", errors));
        }

        User saved = userService.updateAccount(user.get(), request.getAccount());
        return ResponseEntity.ok(AccountResponse.of(saved));
    }
}
