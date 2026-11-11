package com.example.excelapp.controller;

import com.example.excelapp.service.DistributionAssignmentService;
import com.example.excelapp.service.DistributionZoneService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

// חלוקת הזמנות לשקיות לפי אזורי הגמ"ח (#129) - נקודות גישה חדשות בלבד, בלי שינוי
// בנקודות הקיימות של הנמענים. בניסוי הראשון הכל בזיכרון, בלי טבלאות ב-DB
@RestController
@RequestMapping("/api/distribution")
public class DistributionController {

    private final DistributionZoneService zoneService;
    private final DistributionAssignmentService assignmentService;

    public DistributionController(DistributionZoneService zoneService,
                                  DistributionAssignmentService assignmentService) {
        this.zoneService = zoneService;
        this.assignmentService = assignmentService;
    }

    // טעינת קובץ האזורים (מספר אזור | האחראית | כיתה | רחובות) לזיכרון של השרת - מחליפה
    // את האזורים הקודמים, ומחזירה דוח: כמה אזורים ורחובות נטענו, ומה לא פוענח
    @PostMapping(value = "/zones", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadZones(@RequestParam("file") MultipartFile file,
                                         @RequestParam("city") String city) throws IOException {
        try {
            return ResponseEntity.ok(zoneService.replaceZonesFromExcel(file.getInputStream(), city));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/zones")
    public ResponseEntity<List<DistributionZoneService.Zone>> getZones() {
        return ResponseEntity.ok(zoneService.getZones());
    }

    // השיוך של כל הנמענים של המשתמשת לשקיות ולמסלול, מחושב עכשיו (לא נשמר): המשויכים
    // לפי שקית וסדר בתוכה, ואחריהם מי שלא שויכו עם הסיבה
    @GetMapping("/assignments")
    public ResponseEntity<?> getAssignments(@RequestParam String phone) {
        try {
            return ResponseEntity.ok(assignmentService.assignRecipients(phone));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
    }
}
