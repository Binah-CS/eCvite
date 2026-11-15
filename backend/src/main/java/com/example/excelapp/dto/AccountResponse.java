package com.example.excelapp.dto;

import com.example.excelapp.entity.User;
import com.example.excelapp.util.AccountFields;

import java.util.List;

// התשובה של GET/PUT /api/user/account - המשתמשת המעודכנת (נשמרת ב-sessionStorage
// כמו אחרי התחברות) יחד עם רשימות השדות מ-AccountFields, כך שהעמוד יודע מה לנעול
public record AccountResponse(
        User user,
        List<String> editableFields,
        List<String> readOnlyFields,
        List<String> requiredFields
) {
    public static AccountResponse of(User user) {
        return new AccountResponse(user, AccountFields.EDITABLE, AccountFields.READ_ONLY, AccountFields.REQUIRED);
    }
}
