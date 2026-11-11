package com.example.excelapp.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// מפענח את עמודת "רחובות" באקסל של אזורי החלוקה (#129) - טקסט חופשי כמו
// "אביי ורבא, חזו"א 50-60, בן זכאי אי זוגי חוץ מ13 17" - לרשימת רחובות עם טווח, צד,
// בתים בודדים וחריגים. שם הרחוב נשאר כמו שנכתב (בלי נרמול). מה שלא מפוענח (למשל
// אותיות לועזיות) לא נזרק - חוזר כאזהרה, כדי שיראו אותו בדוח הטעינה
public final class ZoneStreetTextParser {

    // איזה צד של הרחוב שייך לאזור
    public enum Side { ALL, ODD, EVEN }

    // טווח בתים כולל את שני הקצוות. null ב-to = "ומעלה" / "עד הסוף", null ב-from = "עד X".
    // בלי טווח, בלי בתים בודדים ובלי צד = כל הרחוב
    public record ParsedStreet(
            String streetName,
            Integer fromNo,
            Integer toNo,
            Side side,
            List<Integer> explicitNumbers,
            List<Integer> exceptNumbers,
            String sourceText,
            String warning
    ) {
    }

    private static final String HEBREW_LETTER = "[\\u05D0-\\u05EA]";
    private static final Pattern NUMBER = Pattern.compile("\\d+");
    // "אי" רק כמילה נפרדת - אחרת "בן זכאי זוגי" נקרא כ"אי זוגי"
    private static final Pattern ODD = Pattern.compile("(?<!" + HEBREW_LETTER + ")אי[\\s-]*זוגי(?:ים)?");
    private static final Pattern EVEN = Pattern.compile("(?<!" + HEBREW_LETTER + ")זוגי(?:ים)?");
    private static final Pattern EXCEPT = Pattern.compile("חוץ\\s*מ[\\s-]*((?:\\d+[\\s,ו]*)+)");
    private static final Pattern OPEN_END = Pattern.compile("ומעלה|והלאה|עד\\s*הסוף");
    private static final Pattern RANGE = Pattern.compile("(\\d+)\\s*(?:-|–|עד)\\s*(\\d+)");
    private static final Pattern ABOVE = Pattern.compile("מעל\\s*(\\d+)");
    private static final Pattern UP_TO = Pattern.compile("(?<!" + HEBREW_LETTER + ")עד\\s*(\\d+)");
    private static final Pattern FROM = Pattern.compile("(?<!" + HEBREW_LETTER + ")מ[\\s-]?(\\d+)");
    private static final Pattern FOREIGN = Pattern.compile("\\S*[A-Za-z]\\S*");

    private ZoneStreetTextParser() {
    }

    public static List<ParsedStreet> parse(String text) {
        List<ParsedStreet> result = new ArrayList<>();
        if (text == null) return result;
        for (String segment : text.split("[,،]")) {
            ParsedStreet parsed = parseSegment(segment);
            if (parsed != null) result.add(parsed);
        }
        return result;
    }

    private static ParsedStreet parseSegment(String segment) {
        String source = segment.replace(' ', ' ').replaceAll("\\s+", " ").trim().replaceAll("\\.+$", "").trim();
        if (source.isEmpty()) return null;

        String work = source;
        List<String> warnings = new ArrayList<>();

        Side side = Side.ALL;
        Matcher m = ODD.matcher(work);
        if (m.find()) {
            side = Side.ODD;
            work = m.replaceAll(" ");
        } else if ((m = EVEN.matcher(work)).find()) {
            side = Side.EVEN;
            work = m.replaceAll(" ");
        }

        List<Integer> except = new ArrayList<>();
        m = EXCEPT.matcher(work);
        if (m.find()) {
            except = numbers(m.group(1));
            work = cut(work, m);
        }

        boolean openEnd = false;
        m = OPEN_END.matcher(work);
        if (m.find()) {
            openEnd = true;
            work = m.replaceAll(" ");
        }

        Integer from = null;
        Integer to = null;
        m = RANGE.matcher(work);
        if (m.find()) {
            from = Integer.parseInt(m.group(1));
            to = Integer.parseInt(m.group(2));
            work = cut(work, m);
        } else {
            if ((m = ABOVE.matcher(work)).find()) {
                from = Integer.parseInt(m.group(1)) + 1;
                work = cut(work, m);
            }
            if ((m = UP_TO.matcher(work)).find()) {
                to = Integer.parseInt(m.group(1));
                work = cut(work, m);
            }
            if (from == null && (m = FROM.matcher(work)).find()) {
                from = Integer.parseInt(m.group(1));
                work = cut(work, m);
            }
        }

        // מספרים שנשארו: "105 עד הסוף" / "20 ומעלה" = מבית זה והלאה, אחרת בתים בודדים ("13 17")
        List<Integer> explicit = new ArrayList<>();
        List<Integer> rest = numbers(work);
        if (!rest.isEmpty()) {
            if (openEnd && from == null && rest.size() == 1) {
                from = rest.get(0);
            } else {
                explicit = rest;
            }
            work = NUMBER.matcher(work).replaceAll(" ");
        } else if (openEnd && from == null) {
            warnings.add("\"ומעלה\" / \"עד הסוף\" בלי מספר בית");
        }

        m = FOREIGN.matcher(work);
        while (m.find()) {
            warnings.add("לא פוענח: " + m.group());
        }
        work = FOREIGN.matcher(work).replaceAll(" ");

        String name = work.replaceAll("\\s+", " ").trim().replaceAll("^[-–\\s]+|[-–\\s]+$", "");
        if (name.isEmpty()) {
            warnings.add("לא נמצא שם רחוב");
        }
        return new ParsedStreet(name, from, to, side, explicit, except, source,
                warnings.isEmpty() ? null : String.join("; ", warnings));
    }

    private static String cut(String text, Matcher m) {
        return text.substring(0, m.start()) + " " + text.substring(m.end());
    }

    private static List<Integer> numbers(String text) {
        List<Integer> list = new ArrayList<>();
        Matcher m = NUMBER.matcher(text);
        while (m.find()) list.add(Integer.parseInt(m.group()));
        return list;
    }
}
