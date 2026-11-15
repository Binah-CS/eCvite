package com.example.excelapp.util;

import com.example.excelapp.entity.User;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;

// מקור האמת היחיד לשדות שבעמוד "פרטי חשבון": אילו מוצגים לקריאה בלבד, אילו ניתנים
// לעריכה ואילו חובה. ה-frontend לא מחזיק רשימה משלו - הוא מקבל את הרשימות מהשרת
// (ר' AccountResponse), כך שאם שדה התחברות משתנה בעתיד מעדכנים רק כאן
public final class AccountFields {

    private AccountFields() {
    }

    // שדות שמשמשים להתחברות (ר' AuthService.findUser - ההתחברות בודקת רק טלפון).
    // מוצגים לקריאה בלבד וכל ניסיון לשלוח אותם בעדכון נדחה
    public static final List<String> READ_ONLY = List.of("phone");

    // allowlist - רק השדות האלה מועתקים מהבקשה לישות. כל שדה אחר (phone, hashCode,
    // createdAt, firstNameMan וכו') נדחה, גם אם הלקוח שלח אותו
    private static final Map<String, BiConsumer<User, String>> EDITABLE_SETTERS = buildEditableSetters();

    public static final List<String> EDITABLE = List.copyOf(EDITABLE_SETTERS.keySet());

    // אותם שדות חובה כמו בטופס ההרשמה (RegisterPage)
    public static final List<String> REQUIRED =
            List.of("firstNameWoman", "lastName", "email", "city", "street", "houseNumber");

    private static Map<String, BiConsumer<User, String>> buildEditableSetters() {
        Map<String, BiConsumer<User, String>> setters = new LinkedHashMap<>();
        setters.put("firstNameWoman", User::setFirstNameWoman);
        setters.put("lastName", User::setLastName);
        setters.put("email", User::setEmail);
        setters.put("eventType", User::setEventType);
        setters.put("city", User::setCity);
        setters.put("street", User::setStreet);
        setters.put("houseNumber", User::setHouseNumber);
        return setters;
    }

    public static boolean isEditable(String field) {
        return EDITABLE_SETTERS.containsKey(field);
    }

    public static boolean isRequired(String field) {
        return REQUIRED.contains(field);
    }

    // מעדכנת שדה אחד שניתן לעריכה. ערך ריק נשמר כ-null (כמו שדה שלא מולא בהרשמה)
    public static void apply(User user, String field, String value) {
        BiConsumer<User, String> setter = EDITABLE_SETTERS.get(field);
        if (setter == null) {
            throw new IllegalArgumentException("Field is not editable: " + field);
        }
        String trimmed = value == null ? "" : value.trim();
        setter.accept(user, trimmed.isEmpty() ? null : trimmed);
    }
}
