package com.example.excelapp.service;

import com.example.excelapp.service.ZoneStreetTextParser.ParsedStreet;
import com.example.excelapp.service.ZoneStreetTextParser.Side;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// כל צורות הכתיבה שמופיעות בעמודת "רחובות" באקסל האמיתי של אזורי הגמ"ח (#129)
class ZoneStreetTextParserTest {

    private ParsedStreet single(String text) {
        List<ParsedStreet> parsed = ZoneStreetTextParser.parse(text);
        assertThat(parsed).hasSize(1);
        return parsed.get(0);
    }

    @Test
    void severalStreetsInOrder_withAndWithoutSpacesAfterComma() {
        List<ParsedStreet> parsed = ZoneStreetTextParser.parse("השל\"ה,אורה\"ח, ברטנורא");

        assertThat(parsed).extracting(ParsedStreet::streetName).containsExactly("השל\"ה", "אורה\"ח", "ברטנורא");
        assertThat(parsed).allSatisfy(p -> {
            assertThat(p.fromNo()).isNull();
            assertThat(p.toNo()).isNull();
            assertThat(p.side()).isEqualTo(Side.ALL);
            assertThat(p.warning()).isNull();
        });
    }

    @Test
    void streetNameKeptExactlyAsWritten() {
        assertThat(single("י'הושוע").streetName()).isEqualTo("י'הושוע");
        assertThat(single("יגא-ל").streetName()).isEqualTo("יגא-ל");
        assertThat(single("ספינקא-הדקלים").streetName()).isEqualTo("ספינקא-הדקלים");
    }

    @Test
    void range() {
        ParsedStreet p = single("חזו\"א 50-60");
        assertThat(p.streetName()).isEqualTo("חזו\"א");
        assertThat(p.fromNo()).isEqualTo(50);
        assertThat(p.toNo()).isEqualTo(60);
    }

    @Test
    void rangeWithoutSpaceAfterName() {
        ParsedStreet p = single("קהילות יעקב1-20");
        assertThat(p.streetName()).isEqualTo("קהילות יעקב");
        assertThat(p.fromNo()).isEqualTo(1);
        assertThat(p.toNo()).isEqualTo(20);
    }

    @Test
    void rangeWithSide() {
        ParsedStreet p = single("רבי עקיבא 69-91 אי זוגי");
        assertThat(p.streetName()).isEqualTo("רבי עקיבא");
        assertThat(p.fromNo()).isEqualTo(69);
        assertThat(p.toNo()).isEqualTo(91);
        assertThat(p.side()).isEqualTo(Side.ODD);
    }

    @Test
    void openEnded() {
        assertThat(single("רבי עקיבא 105 עד הסוף")).satisfies(p -> {
            assertThat(p.streetName()).isEqualTo("רבי עקיבא");
            assertThat(p.fromNo()).isEqualTo(105);
            assertThat(p.toNo()).isNull();
        });
        assertThat(single("שבטי ישראל 20 ומעלה")).satisfies(p -> {
            assertThat(p.fromNo()).isEqualTo(20);
            assertThat(p.toNo()).isNull();
        });
        assertThat(single("ירושלים 60 עד הסוף").fromNo()).isEqualTo(60);
    }

    @Test
    void fromPrefixAttachedToNumber() {
        ParsedStreet p = single("קהילות יעקב מ66");
        assertThat(p.streetName()).isEqualTo("קהילות יעקב");
        assertThat(p.fromNo()).isEqualTo(66);
        assertThat(p.toNo()).isNull();
    }

    @Test
    void aboveAndUpTo() {
        assertThat(single("סוקולוב מעל 30")).satisfies(p -> {
            assertThat(p.streetName()).isEqualTo("סוקולוב");
            assertThat(p.fromNo()).isEqualTo(31);
            assertThat(p.toNo()).isNull();
        });
        assertThat(single("סוקולוב עד 30")).satisfies(p -> {
            assertThat(p.fromNo()).isNull();
            assertThat(p.toNo()).isEqualTo(30);
        });
    }

    @Test
    void wordsStartingWithMemOrAdAreNotNumbers() {
        assertThat(single("מהר\"ל").streetName()).isEqualTo("מהר\"ל");
        assertThat(single("מעונות ויזניץ").streetName()).isEqualTo("מעונות ויזניץ");
        assertThat(single("עדה").streetName()).isEqualTo("עדה");
    }

    // "זכאי זוגי" מכיל את הרצף "אי זוגי" - בכל זאת זוגי, והשם נשאר שלם
    @Test
    void sideOnly() {
        assertThat(single("בן זכאי זוגי")).satisfies(p -> {
            assertThat(p.streetName()).isEqualTo("בן זכאי");
            assertThat(p.side()).isEqualTo(Side.EVEN);
        });
        assertThat(single("בן זכאי אי זוגי")).satisfies(p -> {
            assertThat(p.streetName()).isEqualTo("בן זכאי");
            assertThat(p.side()).isEqualTo(Side.ODD);
        });
    }

    @Test
    void sideWithExceptions() {
        ParsedStreet p = single("בן זכאי אי זוגי חוץ מ13 17");
        assertThat(p.streetName()).isEqualTo("בן זכאי");
        assertThat(p.side()).isEqualTo(Side.ODD);
        assertThat(p.exceptNumbers()).containsExactly(13, 17);
        assertThat(p.explicitNumbers()).isEmpty();
    }

    @Test
    void singleHouseNumbers() {
        ParsedStreet p = single("בן זכאי 13 17");
        assertThat(p.streetName()).isEqualTo("בן זכאי");
        assertThat(p.explicitNumbers()).containsExactly(13, 17);
        assertThat(p.fromNo()).isNull();
        assertThat(p.toNo()).isNull();
    }

    @Test
    void foreignLettersAreReportedNotDropped() {
        ParsedStreet p = single("אחיסמך A'B");
        assertThat(p.streetName()).isEqualTo("אחיסמך");
        assertThat(p.warning()).contains("A'B");
    }

    @Test
    void trailingDotAndEmptySegmentsIgnored() {
        List<ParsedStreet> parsed = ZoneStreetTextParser.parse("לנדא, בעל התניא., ,");
        assertThat(parsed).extracting(ParsedStreet::streetName).containsExactly("לנדא", "בעל התניא");
    }

    @Test
    void sourceTextKept() {
        assertThat(single("אברהם בן דוד 20 ומעלה").sourceText()).isEqualTo("אברהם בן דוד 20 ומעלה");
    }

    @Test
    void emptyOrNull() {
        assertThat(ZoneStreetTextParser.parse(null)).isEmpty();
        assertThat(ZoneStreetTextParser.parse("  ")).isEmpty();
    }
}
