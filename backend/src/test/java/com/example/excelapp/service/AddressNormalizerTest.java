package com.example.excelapp.service;

import com.example.excelapp.service.AddressNormalizer.ParsedAddress;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// נרמול כתובות (#129). הדוגמאות לקוחות מהשוואה של רשימת אזורי הגמ"ח מול כתובות נמענים אמיתיות
class AddressNormalizerTest {

    private static void sameStreet(String a, String b) {
        assertThat(AddressNormalizer.streetKey(a))
                .as("\"%s\" ו-\"%s\" צריכים להיות אותו רחוב", a, b)
                .isEqualTo(AddressNormalizer.streetKey(b));
    }

    private static void differentStreets(String a, String b) {
        assertThat(AddressNormalizer.streetKey(a)).isNotEqualTo(AddressNormalizer.streetKey(b));
    }

    @Test
    void abbreviationsFromTheAliasTable() {
        sameStreet("חזון איש", "חזו\"א");
        sameStreet("אור החיים", "אורה\"ח");
        sameStreet("גבורי ישראל", "גבו\"י");
        sameStreet("גיבורי ישראל", "גבורי ישראל");
        sameStreet("קיבוץ גלויות", "קבוץ גלויות");
        sameStreet("יהושע", "י'הושוע");
        sameStreet("נעם אלימלך", "נועם אלימלך");
        sameStreet("מתתיהו", "מתיתיהו");
        sameStreet("סעדיה גאון", "סעדיה הגאון");
        sameStreet("ברנשטטר", "ברנדשטטר");
        sameStreet("שמעון בן שטח", "בן שטח");
        sameStreet("דון יוסף נשיא", "דון יוסף");
        sameStreet("אברהם בו דוד", "אברהם בן דוד");
        sameStreet("אדור מקוצק", "אדמו\"ר מקוצק");
        sameStreet("ב\"ב", "בני ברק");
    }

    @Test
    void abbreviationAsOneWordInsideTheName() {
        sameStreet("ר' עקיבא", "רבי עקיבא");
        sameStreet("ר׳ עקיבא", "רבי עקיבא");
        sameStreet("האדמור מקוצק", "אדמו\"ר מקוצק");
        sameStreet("האדמו״ר מקוצק", "אדמו\"ר מקוצק");
    }

    @Test
    void punctuationAndQuotesDoNotMatter() {
        sameStreet("רש\"י", "רשי");
        sameStreet("רש״י", "רשי");
        sameStreet("חת\"ם סופר", "חתם סופר");
        sameStreet("ביל\"ו", "בילו");
        sameStreet("בן פתחיה", "בן פתחי'ה");
        sameStreet("עטי'ה", "עטיה");
        sameStreet("אנילביץ", "אנילביץ'");
        sameStreet("ראבד", "ראב\"ד");
        sameStreet("יגא-ל", "יגאל");
        sameStreet("בעל התניא.", "בעל התניא");
        sameStreet("  רבי   עקיבא ", "רבי עקיבא");
        sameStreet("בני-ברק", "בני ברק");
    }

    @Test
    void prefixesDoNotMatter() {
        sameStreet("שדרות כפר עציון", "כפר עציון");
        sameStreet("שד' רמב\"ן", "שדרות רמב\"ן");
        sameStreet("שדרות רמבן", "שדרות רמב\"ן");
        sameStreet("רח' הרצל", "הרצל");
        sameStreet("רחוב הרצל", "הרצל");
        sameStreet("הרב פוברסקי", "פוברסקי");
        sameStreet("הרב ורנר", "ורנר");
        sameStreet("הרב קוק", "הרב קוק");
    }

    @Test
    void prefixAloneIsNotRemoved() {
        assertThat(AddressNormalizer.streetKey("הרב")).isEqualTo("הרב");
    }

    @Test
    void differentStreetsStayDifferent() {
        differentStreets("עזרא", "אבן עזרא");
        differentStreets("רבי עקיבא", "רבי מאיר");
        differentStreets("יהודה הלוי", "יהודה הנשיא");
        differentStreets("בן זכאי", "בן עזאי");
    }

    @Test
    void emptyStreet() {
        assertThat(AddressNormalizer.streetKey(null)).isEmpty();
        assertThat(AddressNormalizer.streetKey("  ")).isEmpty();
    }

    @Test
    void houseNumberFromItsOwnField() {
        assertThat(AddressNormalizer.parseAddress("רבי עקיבא", "12")).isEqualTo(new ParsedAddress("רבי עקיבא", 12, null));
        assertThat(AddressNormalizer.parseAddress("חזון איש", "12א")).isEqualTo(new ParsedAddress("חזון איש", 12, "א"));
        assertThat(AddressNormalizer.parseAddress("חזון איש", "12 א")).isEqualTo(new ParsedAddress("חזון איש", 12, "א"));
        assertThat(AddressNormalizer.parseAddress("קרית הישיבה", "1509/9").houseNumber()).isEqualTo(1509);
        assertThat(AddressNormalizer.parseAddress("הרצל", "12-14").houseNumber()).isEqualTo(12);
    }

    @Test
    void houseNumberWrittenInsideTheStreetField() {
        assertThat(AddressNormalizer.parseAddress("רבי עקיבא 12", "")).isEqualTo(new ParsedAddress("רבי עקיבא", 12, null));
        assertThat(AddressNormalizer.parseAddress("רבי עקיבא 12א", null)).isEqualTo(new ParsedAddress("רבי עקיבא", 12, "א"));
        assertThat(AddressNormalizer.parseAddress("אבני נזר 8 ב'", "")).isEqualTo(new ParsedAddress("אבני נזר", 8, "ב"));
        assertThat(AddressNormalizer.parseAddress("ר' עקיבא 18 ב'", "")).isEqualTo(new ParsedAddress("ר' עקיבא", 18, "ב"));
        assertThat(AddressNormalizer.parseAddress("נויפלד 20 קרית הרצוג", "")).isEqualTo(new ParsedAddress("נויפלד", 20, null));
    }

    @Test
    void noHouseNumber() {
        assertThat(AddressNormalizer.parseAddress("הרצל", "")).isEqualTo(new ParsedAddress("הרצל", null, null));
        assertThat(AddressNormalizer.parseAddress("הרצל", "אין")).isEqualTo(new ParsedAddress("הרצל", null, null));
        assertThat(AddressNormalizer.parseAddress(null, null)).isEqualTo(new ParsedAddress("", null, null));
    }
}
