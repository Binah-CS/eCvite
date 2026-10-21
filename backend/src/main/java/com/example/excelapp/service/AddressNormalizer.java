package com.example.excelapp.service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// נרמול כתובות לפני ההשוואה בין כתובת של נמען לרחובות של אזורי החלוקה (#129).
// streetKey מחזיר "מפתח" לרחוב: שתי צורות כתיבה של אותו רחוב ("חזון איש" / "חזו"א",
// "ר' עקיבא" / "רבי עקיבא", "שדרות כפר עציון" / "כפר עציון") מקבלות אותו מפתח.
// הכתובת השמורה של הנמען לא משתנה - המפתח משמש רק להשוואה.
// בניסוי הראשון טבלת הנרמול כתובה כאן בקוד (ALIASES), בלי טבלה ב-DB
public final class AddressNormalizer {

    public record ParsedAddress(String street, Integer houseNumber, String houseSuffix) {
    }

    // טבלת הנרמול: צורת כתיבה -> השם שהיא מייצגת. כינוי יכול להיות שם רחוב שלם ("גבו"י")
    // או מילה אחת בתוך השם ("ר'" ב"ר' עקיבא"). נמצאו בבדיקת רשימת אזורי הגמ"ח מול כתובות
    // נמענים אמיתיות. כינוי חדש = שורה חדשה כאן
    static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("חזו\"א", "חזון איש"),
            Map.entry("ר'", "רבי"),
            Map.entry("אורה\"ח", "אור החיים"),
            Map.entry("גבו\"י", "גבורי ישראל"),
            Map.entry("גיבורי ישראל", "גבורי ישראל"),
            Map.entry("האדמו\"ר", "אדמו\"ר"),
            Map.entry("קבוץ גלויות", "קיבוץ גלויות"),
            Map.entry("מתיתיהו", "מתתיהו"),
            Map.entry("נעם אלימלך", "נועם אלימלך"),
            Map.entry("סעדיה גאון", "סעדיה הגאון"),
            Map.entry("ברנשטטר", "ברנדשטטר"),
            Map.entry("שמעון בן שטח", "בן שטח"),
            Map.entry("דון יוסף נשיא", "דון יוסף"),
            Map.entry("י'הושוע", "יהושע"),
            // קיצור של שם העיר - העיר עוברת את אותו נרמול לפני ההשוואה לעיר של הגמ"ח
            Map.entry("ב\"ב", "בני ברק"),
            // שגיאות הקלדה שנמצאו בכתובות נמענים
            Map.entry("אברהם בו דוד", "אברהם בן דוד"),
            Map.entry("אדור מקוצק", "אדמו\"ר מקוצק")
    );

    // מילים בתחילת שם הרחוב שלא משנות איזה רחוב זה ("רח' הרצל" = "הרצל", "הרב פוברסקי" =
    // "פוברסקי"). לפי המפתח שלהן, כך שגם "רח" בלי גרש נחשב. לא מוסרות אם הן כל השם
    private static final Set<String> PREFIX_KEYS = Set.of("רחוב", "רח", "שדרות", "שד", "הרב");

    private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^\\u05D0-\\u05EAa-zA-Z0-9]");
    // רחוב, מספר, ואחריו אולי אות בודדת ועוד טקסט ("אבני נזר 8 ב'", "נויפלד 20 קרית הרצוג")
    private static final Pattern NUMBER_IN_STREET =
            Pattern.compile("^(.*?[^\\d\\s])\\s*(\\d+)(?:\\s*([\\u05D0-\\u05EA])(?![\\u05D0-\\u05EA]))?.*$");
    private static final Pattern HOUSE = Pattern.compile("^\\D*?(\\d+)\\s*([\\u05D0-\\u05EA])?");

    private static final Map<String, String> ALIAS_BY_KEY = new HashMap<>();

    static {
        ALIASES.forEach((alias, canonical) -> ALIAS_BY_KEY.put(key(alias), canonical));
    }

    private AddressNormalizer() {
    }

    // סדר הפעולות: אחידות בפיסוק, הסרת קידומת, כינוי לשם המלא, כינוי לכל מילה (ר' -> רבי),
    // ושוב כינוי לשם המלא (אחרי שהמילים הוחלפו). בסוף - רק אותיות וספרות
    public static String streetKey(String street) {
        if (street == null || street.isBlank()) return "";
        String s = stripPrefixes(unify(street));
        s = applyWholeName(s);
        s = applyPerWord(s);
        s = applyWholeName(stripPrefixes(s));
        return key(s);
    }

    // מפריד מספר בית מהרחוב: מספר הבית מהשדה שלו, ואם השדה ריק - מתוך שדה הרחוב
    // ("רבי עקיבא 12"; מה שאחרי המספר נזרק). אות אחרי המספר נשמרת בנפרד ("12א" -> 12, "א")
    public static ParsedAddress parseAddress(String street, String houseNo) {
        String cleanStreet = street == null ? "" : unify(street);
        String house = houseNo == null ? "" : houseNo.trim();
        if (house.isEmpty()) {
            Matcher m = NUMBER_IN_STREET.matcher(cleanStreet);
            if (m.matches()) {
                cleanStreet = m.group(1).trim();
                house = m.group(2) + (m.group(3) == null ? "" : m.group(3));
            }
        }
        Matcher m = HOUSE.matcher(house);
        if (!m.find()) return new ParsedAddress(cleanStreet, null, null);
        return new ParsedAddress(cleanStreet, Integer.parseInt(m.group(1)), m.group(2));
    }

    static String key(String text) {
        return NOT_LETTER_OR_DIGIT.matcher(unify(text)).replaceAll("").toLowerCase(Locale.ROOT);
    }

    private static String unify(String text) {
        return text.replace('״', '"').replace('“', '"').replace('”', '"').replace('„', '"')
                .replace('׳', '\'').replace('’', '\'').replace('‘', '\'').replace('`', '\'').replace('´', '\'')
                .replace(' ', ' ').replaceAll("\\s+", " ").trim().replaceAll("\\.+$", "");
    }

    private static String stripPrefixes(String s) {
        String[] words = s.split(" ");
        int start = 0;
        while (start < words.length - 1 && PREFIX_KEYS.contains(key(words[start]))) start++;
        return String.join(" ", Arrays.copyOfRange(words, start, words.length));
    }

    private static String applyWholeName(String s) {
        String canonical = ALIAS_BY_KEY.get(key(s));
        return canonical == null ? s : unify(canonical);
    }

    private static String applyPerWord(String s) {
        StringJoiner joined = new StringJoiner(" ");
        for (String word : s.split(" ")) {
            String canonical = ALIAS_BY_KEY.get(key(word));
            joined.add(canonical == null ? word : unify(canonical));
        }
        return joined.toString();
    }
}
