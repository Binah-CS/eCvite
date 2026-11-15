package com.example.excelapp.util;

import com.example.excelapp.entity.UserSender;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Function;

// מקור האמת לשדות פרטי השולח (כמו AccountFields לפרטי החשבון). כל השדות ניתנים
// לעריכה; רק הם מועתקים מהבקשה לישות, וה-frontend מקבל את הרשימה מהשרת
public final class SenderFields {

    private SenderFields() {
    }

    private record Accessor(Function<UserSender, String> getter, BiConsumer<UserSender, String> setter) {
    }

    private static final Map<String, Accessor> ACCESSORS = buildAccessors();

    public static final List<String> ALL = List.copyOf(ACCESSORS.keySet());

    // שדות הכתובת בעברית - אם אחד מהם מולא, רחוב ועיר בעברית חובה. שם לשליחה לבד
    // לא מחייב כתובת, כי כתובת עברית ריקה נלקחת מהחשבון
    public static final List<String> HEBREW_ADDRESS = List.of("street", "houseNo", "city", "zip", "country");

    // כל שדות האנגלית - אם אחד מהם מולא (גם שם), רחוב ועיר באנגלית חובה, כי לאנגלית
    // אין fallback
    public static final List<String> ENGLISH =
            List.of("displayNameEn", "streetEn", "houseNoEn", "cityEn", "zipEn", "countryEn");

    private static Map<String, Accessor> buildAccessors() {
        Map<String, Accessor> accessors = new LinkedHashMap<>();
        accessors.put("displayName", new Accessor(UserSender::getDisplayName, UserSender::setDisplayName));
        accessors.put("street", new Accessor(UserSender::getStreet, UserSender::setStreet));
        accessors.put("houseNo", new Accessor(UserSender::getHouseNo, UserSender::setHouseNo));
        accessors.put("city", new Accessor(UserSender::getCity, UserSender::setCity));
        accessors.put("zip", new Accessor(UserSender::getZip, UserSender::setZip));
        accessors.put("country", new Accessor(UserSender::getCountry, UserSender::setCountry));
        accessors.put("displayNameEn", new Accessor(UserSender::getDisplayNameEn, UserSender::setDisplayNameEn));
        accessors.put("streetEn", new Accessor(UserSender::getStreetEn, UserSender::setStreetEn));
        accessors.put("houseNoEn", new Accessor(UserSender::getHouseNoEn, UserSender::setHouseNoEn));
        accessors.put("cityEn", new Accessor(UserSender::getCityEn, UserSender::setCityEn));
        accessors.put("zipEn", new Accessor(UserSender::getZipEn, UserSender::setZipEn));
        accessors.put("countryEn", new Accessor(UserSender::getCountryEn, UserSender::setCountryEn));
        return accessors;
    }

    public static boolean isKnown(String field) {
        return ACCESSORS.containsKey(field);
    }

    // מחליפה את כל פרטי השולח בערכים שנשלחו (הלקוח שולח תמיד את השולח המלא). שדה
    // שלא נשלח או ריק נשמר כ-null
    public static void applyAll(UserSender sender, Map<String, String> values) {
        ACCESSORS.forEach((field, accessor) -> {
            String trimmed = Objects.toString(values.get(field), "").trim();
            accessor.setter().accept(sender, trimmed.isEmpty() ? null : trimmed);
        });
    }

    // השולח כמפה פשוטה לתשובת ה-API - בלי לחשוף את הישות עצמה (וה-User שבתוכה)
    public static Map<String, String> toMap(UserSender sender) {
        Map<String, String> values = new LinkedHashMap<>();
        ACCESSORS.forEach((field, accessor) -> values.put(field, Objects.toString(accessor.getter().apply(sender), "")));
        return values;
    }
}
