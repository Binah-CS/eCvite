package com.example.excelapp.dto;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserSender;
import com.example.excelapp.util.AccountFields;
import com.example.excelapp.util.SenderFields;

import java.util.List;
import java.util.Map;

// התשובה של GET/PUT /api/user/account - המשתמשת המעודכנת (נשמרת ב-sessionStorage
// כמו אחרי התחברות), פרטי השולח שלה (null = עוד לא נשמרו) ורשימות השדות
// מ-AccountFields / SenderFields, כך שהעמוד יודע מה להציג ומה לנעול
public record AccountResponse(
        User user,
        List<String> editableFields,
        List<String> readOnlyFields,
        List<String> requiredFields,
        Map<String, String> sender,
        List<String> senderFields
) {
    public static AccountResponse of(User user, UserSender sender) {
        return new AccountResponse(
                user,
                AccountFields.EDITABLE,
                AccountFields.READ_ONLY,
                AccountFields.REQUIRED,
                sender == null ? null : SenderFields.toMap(sender),
                SenderFields.ALL
        );
    }
}
