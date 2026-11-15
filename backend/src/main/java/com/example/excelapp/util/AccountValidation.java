package com.example.excelapp.util;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

// ולידציה של עדכון "פרטי חשבון" בצד השרת - לא סומכים על הבדיקות של הלקוח.
// הביטויים זהים ל-GMAIL_REGEX / HOUSE_NO_PATTERN ב-frontend/src/utils/validation.js -
// שינוי כאן צריך להיעשות גם שם
public final class AccountValidation {

    private AccountValidation() {
    }

    public static final Pattern GMAIL = Pattern.compile("^[a-zA-Z0-9._%+-]+@gmail\\.com$");

    // מספר בית: ספרות, ואפשר אות אחת בסוף (כמו "12" או "12א")
    public static final Pattern HOUSE_NO = Pattern.compile("^\\d+[a-zA-Z\\u05D0-\\u05EA]?$");

    // אורך ברירת המחדל של עמודת VARCHAR ש-Hibernate יוצר
    public static final int MAX_LENGTH = 255;

    public static final String NOT_EDITABLE = "לא ניתן לעדכן שדה זה";
    public static final String REQUIRED = "שדה חובה";
    public static final String TOO_LONG = "הערך ארוך מדי";
    public static final String INVALID_EMAIL = "המייל שהוזן אינו תקין";
    public static final String INVALID_HOUSE_NO = "מספר בית לא תקין";

    // מחזירה מפה של שדה -> הודעת שגיאה (ריקה = תקין). נבדקים רק השדות שנשלחו - שדה
    // שלא נשלח לא משתנה, ולכן נשאר עם הערך התקין שכבר שמור
    public static Map<String, String> validateAccount(Map<String, String> values) {
        Map<String, String> errors = new LinkedHashMap<>();
        values.forEach((field, raw) -> {
            String error = validateField(field, raw == null ? "" : raw.trim());
            if (error != null) {
                errors.put(field, error);
            }
        });
        return errors;
    }

    private static String validateField(String field, String value) {
        if (!AccountFields.isEditable(field)) return NOT_EDITABLE;
        if (value.isEmpty()) return AccountFields.isRequired(field) ? REQUIRED : null;
        if (value.length() > MAX_LENGTH) return TOO_LONG;
        if (field.equals("email") && !GMAIL.matcher(value).matches()) return INVALID_EMAIL;
        if (field.equals("houseNumber") && !HOUSE_NO.matcher(value).matches()) return INVALID_HOUSE_NO;
        return null;
    }
}
