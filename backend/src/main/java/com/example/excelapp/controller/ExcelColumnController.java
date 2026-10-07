package com.example.excelapp.controller;



import com.example.excelapp.model.ExcelColumn;
import com.example.excelapp.repository.ExcelColumnRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recipient-columns")
public class ExcelColumnController {

    private final ExcelColumnRepository excelColumnRepository;

    public ExcelColumnController(ExcelColumnRepository excelColumnRepository) {
        this.excelColumnRepository = excelColumnRepository;
    }

    @GetMapping
    public ResponseEntity<List<ExcelColumn>> getColumns() {
        return ResponseEntity.ok(
                excelColumnRepository.findAllByOrderByDefaultOrderAsc()
        );
    }

    // מוסיף כותרת עמודה מקובץ Excel כ"כינוי" חדש לשדה שנבחר ידנית במסך ההתאמה - כדי
    // שבפעם הבאה שאותה כותרת תופיע בקובץ (אצל כל משתמשת, לא רק אצל מי שהתאימה), היא
    // תזוהה אוטומטית בלי לשאול שוב. הפרונט כבר מדלג על קריאה לזה בשביל כותרות סינתטיות
    // ("גליון X עמודה Y", לעמודות בלי כותרת אמיתית בקובץ) - כאן רק שומרים את מה שנשלח
    @PostMapping("/{technicalName}/aliases")
    public ResponseEntity<ExcelColumn> addAlias(
            @PathVariable String technicalName,
            @RequestBody Map<String, String> body
    ) {
        String newAlias = body.get("alias");

        ExcelColumn column = excelColumnRepository.findAllByOrderByDefaultOrderAsc().stream()
                .filter(c -> c.getTechnicalName().equals(technicalName))
                .findFirst()
                .orElseThrow();

        List<String> existing = Arrays.stream(
                        (column.getAliases() == null ? "" : column.getAliases()).split(","))
                .map(String::trim)
                .collect(Collectors.toList());

        if (newAlias != null && !newAlias.isBlank() && !existing.contains(newAlias.trim())) {
            String updated = column.getAliases() == null || column.getAliases().isBlank()
                    ? newAlias.trim()
                    : column.getAliases() + "," + newAlias.trim();
            column.setAliases(updated);
            excelColumnRepository.save(column);
        }

        return ResponseEntity.ok(column);
    }
}