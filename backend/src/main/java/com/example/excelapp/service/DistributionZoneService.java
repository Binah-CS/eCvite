package com.example.excelapp.service;

import com.example.excelapp.service.ZoneStreetTextParser.ParsedStreet;
import com.example.excelapp.service.ZoneStreetTextParser.Side;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;

// אזורי החלוקה של הגמ"ח (#129), נטענים מקובץ האקסל של רשימת המתנדבות: מספר אזור |
// האחראית | כיתה | רחובות. בניסוי הראשון הכל בזיכרון של השרת, בלי טבלאות ב-DB: כל
// טעינה מחליפה את האזורים הקודמים, והם נשמרים עד שהשרת מופעל מחדש.
// העמודות מזוהות לפי הכותרת ולא לפי המיקום, כדי שסדר עמודות אחר לא ישבור את הטעינה
@Service
public class DistributionZoneService {

    // אזור = שקית. הרחובות לפי הסדר שבו נכתבו באקסל
    public record Zone(int zoneNumber, String carrierName, String className, String city, List<ZoneStreet> streets) {
    }

    // רחוב (או חלק מרחוב) באזור, עם המספר הסידורי שלו באזור. שם הרחוב כמו שנכתב באקסל
    public record ZoneStreet(
            int streetOrder,
            String streetName,
            Integer fromNo,
            Integer toNo,
            Side side,
            List<Integer> explicitNumbers,
            List<Integer> exceptNumbers,
            String sourceText
    ) {
    }

    public record UploadReport(int zonesLoaded, int streetsLoaded, List<String> warnings) {
    }

    private static final int HEADER_SEARCH_ROWS = 10;

    private volatile List<Zone> zones = List.of();

    public List<Zone> getZones() {
        return zones;
    }

    public UploadReport replaceZonesFromExcel(InputStream excel, String city) throws IOException {
        if (city == null || city.isBlank()) {
            throw new IllegalArgumentException("חסרה העיר של הגמ\"ח");
        }

        List<String> warnings = new ArrayList<>();
        List<Zone> loaded = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(excel)) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            Map<String, Integer> columns = findColumns(sheet, formatter);
            int headerRow = columns.remove("headerRow");

            Set<Integer> seen = new HashSet<>();
            for (int r = headerRow + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String zoneText = cellText(row, columns.get("zone"), formatter);
                if (zoneText.isEmpty()) continue;

                Integer zoneNumber = parseZoneNumber(zoneText);
                if (zoneNumber == null) {
                    warnings.add("שורה " + (r + 1) + ": מספר אזור לא תקין - \"" + zoneText + "\"");
                    continue;
                }
                if (!seen.add(zoneNumber)) {
                    warnings.add("אזור " + zoneNumber + ": מופיע יותר מפעם אחת - נטענה רק השורה הראשונה");
                    continue;
                }

                List<ZoneStreet> streets = new ArrayList<>();
                for (ParsedStreet parsed : ZoneStreetTextParser.parse(cellText(row, columns.get("streets"), formatter))) {
                    if (parsed.warning() != null) {
                        warnings.add("אזור " + zoneNumber + ", \"" + parsed.sourceText() + "\": " + parsed.warning());
                    }
                    if (parsed.streetName().isEmpty()) continue;
                    streets.add(new ZoneStreet(streets.size() + 1, parsed.streetName(), parsed.fromNo(), parsed.toNo(),
                            parsed.side(), parsed.explicitNumbers(), parsed.exceptNumbers(), parsed.sourceText()));
                }
                if (streets.isEmpty()) {
                    warnings.add("אזור " + zoneNumber + ": אין רחובות");
                }
                loaded.add(new Zone(zoneNumber,
                        blankToNull(cellText(row, columns.get("carrier"), formatter)),
                        blankToNull(cellText(row, columns.get("class"), formatter)),
                        city.trim(),
                        List.copyOf(streets)));
            }
        }

        if (loaded.isEmpty()) {
            throw new IllegalArgumentException("לא נמצאו אזורים בקובץ");
        }

        loaded.sort(Comparator.comparingInt(Zone::zoneNumber));
        zones = List.copyOf(loaded);

        int streets = loaded.stream().mapToInt(z -> z.streets().size()).sum();
        return new UploadReport(loaded.size(), streets, warnings);
    }

    // שורת הכותרות היא הראשונה (מבין הראשונות) שיש בה עמודה עם המילה "אזור"
    private Map<String, Integer> findColumns(Sheet sheet, DataFormatter formatter) {
        for (int r = sheet.getFirstRowNum(); r <= Math.min(sheet.getLastRowNum(), HEADER_SEARCH_ROWS); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            Map<String, Integer> columns = new HashMap<>();
            for (Cell cell : row) {
                String header = formatter.formatCellValue(cell).trim();
                if (header.contains("אזור")) columns.putIfAbsent("zone", cell.getColumnIndex());
                else if (header.contains("אחראית")) columns.putIfAbsent("carrier", cell.getColumnIndex());
                else if (header.contains("כיתה")) columns.putIfAbsent("class", cell.getColumnIndex());
                else if (header.contains("רחוב")) columns.putIfAbsent("streets", cell.getColumnIndex());
            }
            if (columns.containsKey("zone")) {
                if (!columns.containsKey("streets")) {
                    throw new IllegalArgumentException("בקובץ אין עמודת \"רחובות\"");
                }
                columns.put("headerRow", r);
                return columns;
            }
        }
        throw new IllegalArgumentException("בקובץ אין שורת כותרות עם עמודת \"מספר אזור\"");
    }

    private String cellText(Row row, Integer column, DataFormatter formatter) {
        if (column == null) return "";
        Cell cell = row.getCell(column);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private Integer parseZoneNumber(String text) {
        String digits = text.replaceAll("\\D", "");
        if (digits.isEmpty() || digits.length() > 6) return null;
        return Integer.parseInt(digits);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
