package com.example.excelapp.controller;

import com.example.excelapp.service.DistributionZoneService;
import com.example.excelapp.service.DistributionZoneService.Zone;
import com.example.excelapp.service.DistributionZoneService.ZoneStreet;
import com.example.excelapp.service.ZoneStreetTextParser.Side;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// טעינת קובץ אזורי החלוקה (#129) לזיכרון של השרת. הקובץ נבנה בזיכרון באותו מבנה
// כמו רשימת המתנדבות של הגמ"ח, עם שמות בדויים
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DistributionControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private DistributionZoneService zoneService;

    private MockMultipartFile excel(String[]... rows) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("אזורים");
            for (int r = 0; r < rows.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) {
                    if (rows[r][c] != null) row.createCell(c).setCellValue(rows[r][c]);
                }
            }
            workbook.write(out);
            return new MockMultipartFile("file", "zones.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
        }
    }

    private MockMultipartFile sampleExcel() throws IOException {
        return excel(
                new String[]{"מספר אזור", "האחראית", "כיתה", "רחובות"},
                new String[]{"4", "אחראית א", "ה1", "אביי ורבא, מהר\"ל, בן זכאי 13 17"},
                new String[]{"5", "אחראית ב", "ה1", "חזו\"א 50-60"},
                new String[]{"10", null, null, null},
                new String[]{"19", "אחראית ג", "ה2", "אחיסמך A'B"},
                new String[]{"45", "אחראית ד", "ה7", "בן זכאי אי זוגי חוץ מ13 17, הגר\"א"}
        );
    }

    @Test
    void upload_keepsZonesAndNumberedStreets() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", "בני ברק"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.zonesLoaded").value(5))
                .andExpect(jsonPath("$.streetsLoaded").value(7));

        List<Zone> zones = zoneService.getZones();
        assertThat(zones).extracting(Zone::zoneNumber).containsExactly(4, 5, 10, 19, 45);

        Zone zone4 = zones.get(0);
        assertThat(zone4.carrierName()).isEqualTo("אחראית א");
        assertThat(zone4.className()).isEqualTo("ה1");
        assertThat(zone4.city()).isEqualTo("בני ברק");
        assertThat(zone4.streets()).extracting(ZoneStreet::streetOrder).containsExactly(1, 2, 3);
        assertThat(zone4.streets()).extracting(ZoneStreet::streetName).containsExactly("אביי ורבא", "מהר\"ל", "בן זכאי");
        assertThat(zone4.streets().get(2).explicitNumbers()).containsExactly(13, 17);

        ZoneStreet chazonIsh = zones.get(1).streets().get(0);
        assertThat(chazonIsh.streetName()).isEqualTo("חזו\"א");
        assertThat(chazonIsh.fromNo()).isEqualTo(50);
        assertThat(chazonIsh.toNo()).isEqualTo(60);
        assertThat(chazonIsh.sourceText()).isEqualTo("חזו\"א 50-60");

        ZoneStreet benZakaiOdd = zones.get(4).streets().get(0);
        assertThat(benZakaiOdd.side()).isEqualTo(Side.ODD);
        assertThat(benZakaiOdd.exceptNumbers()).containsExactly(13, 17);

        assertThat(zones.get(2).streets()).isEmpty();
    }

    @Test
    void upload_reportsWhatCouldNotBeParsed() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", "בני ברק"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warnings", hasItem("אזור 10: אין רחובות")))
                .andExpect(jsonPath("$.warnings", hasItem(containsString("A'B"))));
    }

    @Test
    void upload_replacesPreviousZones() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", "בני ברק"))
                .andExpect(status().isOk());
        mockMvc.perform(multipart("/api/distribution/zones")
                        .file(excel(new String[]{"מספר אזור", "האחראית", "כיתה", "רחובות"},
                                new String[]{"4", "אחראית חדשה", "ה1", "נחמיה"}))
                        .param("city", "בני ברק"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.zonesLoaded").value(1));

        List<Zone> zones = zoneService.getZones();
        assertThat(zones).hasSize(1);
        assertThat(zones.get(0).carrierName()).isEqualTo("אחראית חדשה");
        assertThat(zones.get(0).streets()).extracting(ZoneStreet::streetName).containsExactly("נחמיה");
    }

    @Test
    void upload_columnsFoundByHeaderNotPosition() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones")
                        .file(excel(new String[]{"רחובות", "כיתה", "מספר אזור", "האחראית"},
                                new String[]{"נחמיה, ורנר", "ד1", "1", "אחראית א"}))
                        .param("city", "בני ברק"))
                .andExpect(status().isOk());

        Zone zone = zoneService.getZones().get(0);
        assertThat(zone.zoneNumber()).isEqualTo(1);
        assertThat(zone.carrierName()).isEqualTo("אחראית א");
        assertThat(zone.streets()).extracting(ZoneStreet::streetName).containsExactly("נחמיה", "ורנר");
    }

    @Test
    void upload_duplicateZoneNumber_keepsFirstAndWarns() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones")
                        .file(excel(new String[]{"מספר אזור", "האחראית", "כיתה", "רחובות"},
                                new String[]{"7", "ראשונה", "ה1", "טולדנו"},
                                new String[]{"7", "שנייה", "ה1", "סורוצקין"}))
                        .param("city", "בני ברק"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.zonesLoaded").value(1))
                .andExpect(jsonPath("$.warnings[0]").value(containsString("יותר מפעם אחת")));

        assertThat(zoneService.getZones().get(0).carrierName()).isEqualTo("ראשונה");
    }

    @Test
    void upload_invalidFile_isRejectedAndKeepsPreviousZones() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", "בני ברק"))
                .andExpect(status().isOk());

        mockMvc.perform(multipart("/api/distribution/zones")
                        .file(excel(new String[]{"שם", "טלפון"}, new String[]{"א", "1"}))
                        .param("city", "בני ברק"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(containsString("מספר אזור")));
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", " "))
                .andExpect(status().isBadRequest());

        assertThat(zoneService.getZones()).hasSize(5);
    }

    @Test
    void getZones_returnsZonesWithStreetsInOrder() throws Exception {
        mockMvc.perform(multipart("/api/distribution/zones").file(sampleExcel()).param("city", "בני ברק"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/distribution/zones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].zoneNumber").value(4))
                .andExpect(jsonPath("$[0].streets[0].streetName").value("אביי ורבא"))
                .andExpect(jsonPath("$[0].streets[2].explicitNumbers[1]").value(17));
    }
}
