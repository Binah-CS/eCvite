package com.example.excelapp.service;

import com.example.excelapp.entity.Recipients;
import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.repository.RecipientsRepository;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.DistributionAssignmentService.AssignmentResult;
import com.example.excelapp.service.DistributionAssignmentService.AssignmentRow;
import com.example.excelapp.service.DistributionAssignmentService.UnassignedReason;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// שיוך נמענים לשקיות ולמסלול (#129). האזורים הם קטע מרשימת אזורי הגמ"ח האמיתית (עם
// שמות אחראיות בדויים), בזיכרון; הנמענים בדויים, במסד הבדיקות (H2)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DistributionAssignmentServiceTest {

    private static final String PHONE = "0501112233";

    @Autowired
    private DistributionAssignmentService assignmentService;
    @Autowired
    private DistributionZoneService zoneService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RecipientsRepository recipientsRepository;
    @Autowired
    private UserRecipientsRepository userRecipientsRepository;
    @Autowired
    private MockMvc mockMvc;

    private User user;

    @BeforeEach
    void loadZonesAndUser() throws Exception {
        String[][] rows = {
                {"מספר אזור", "האחראית", "כיתה", "רחובות"},
                {"1", "אחראית 1", "ד1", "נחמיה, ורנר"},
                {"4", "אחראית 4", "ה1", "אביי ורבא, מהר\"ל, בן זכאי 13 17"},
                {"5", "אחראית 5", "ה1", "חזו\"א 50-60"},
                {"27", "אחראית 27", "ה5", "חזו\"א 30-50"},
                {"29", "אחראית 29", "ה5", "חזו\"א 60 ומעלה"},
                {"45", "אחראית 45", "ה7", "בן זכאי אי זוגי חוץ מ13 17, הגר\"א"},
                {"46", "אחראית 46", "ה7", "רבי עקיבא 69-91 אי זוגי"},
                {"50", "אחראית 50", "ה7", "השל\"ה, אורה\"ח, חזו\"א 1-30"},
                {"64", "אחראית 64", "ה7", "סמטת יבנה, בן זכאי זוגי"},
        };
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet();
            for (int r = 0; r < rows.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) row.createCell(c).setCellValue(rows[r][c]);
            }
            workbook.write(out);
            zoneService.replaceZonesFromExcel(new ByteArrayInputStream(out.toByteArray()), "בני ברק");
        }

        user = User.builder().firstNameMan("בודקת").lastName("חלוקה").phone(PHONE).build();
        user.setHashCode(user.generateHashCode());
        userRepository.save(user);
    }

    private Recipients recipient(String name, String city, String street, String houseNo) {
        Recipients r = new Recipients();
        r.setMan(name);
        r.setLastName("נמען");
        r.setCity(city);
        r.setStreet(street);
        r.setHouseNo(houseNo);
        r.setHashCode(r.generateRowHashCode());
        recipientsRepository.save(r);

        UserRecipients link = new UserRecipients();
        link.setUser(user);
        link.setRecipient(r);
        userRecipientsRepository.save(link);
        return r;
    }

    private AssignmentRow rowOf(AssignmentResult result, Recipients r) {
        return result.rows().stream().filter(row -> row.recipientHash().equals(r.getHashCode())).findFirst().orElseThrow();
    }

    private AssignmentRow assignOne(String street, String houseNo) {
        Recipients r = recipient("נמען " + street + " " + houseNo, "בני ברק", street, houseNo);
        return rowOf(assignmentService.assignRecipients(PHONE), r);
    }

    @Test
    void streetWithRange() {
        AssignmentRow row = assignOne("חזון איש", "42");
        assertThat(row.zoneNumber()).isEqualTo(27);
        assertThat(row.carrierName()).isEqualTo("אחראית 27");
        assertThat(row.className()).isEqualTo("ה5");
        assertThat(row.unassignedReason()).isNull();
    }

    @Test
    void abbreviationInTheRecipientAddressMatchesTheZone() {
        assertThat(assignOne("חזו\"א", "42").zoneNumber()).isEqualTo(27);
        assertThat(assignOne("אור החיים", "5").zoneNumber()).isEqualTo(50);
    }

    @Test
    void houseOnTheBoundaryOfTwoRangesGoesToTheRangeStartingThere() {
        assertThat(assignOne("חזון איש", "29").zoneNumber()).isEqualTo(50);
        assertThat(assignOne("חזון איש", "30").zoneNumber()).isEqualTo(27);
        assertThat(assignOne("חזון איש", "50").zoneNumber()).isEqualTo(5);
        assertThat(assignOne("חזון איש", "60").zoneNumber()).isEqualTo(29);
        assertThat(assignOne("חזון איש", "250").zoneNumber()).isEqualTo(29);
    }

    @Test
    void splitStreetBySideAndSingleHouses() {
        assertThat(assignOne("בן זכאי", "13").zoneNumber()).isEqualTo(4);
        assertThat(assignOne("בן זכאי", "17").zoneNumber()).isEqualTo(4);
        assertThat(assignOne("בן זכאי", "15").zoneNumber()).isEqualTo(45);
        assertThat(assignOne("בן זכאי", "14").zoneNumber()).isEqualTo(64);
    }

    @Test
    void rangeWithSide() {
        assertThat(assignOne("ר' עקיבא", "69").zoneNumber()).isEqualTo(46);
        assertThat(assignOne("רבי עקיבא", "91").zoneNumber()).isEqualTo(46);
    }

    @Test
    void wholeStreetWithoutHouseNumberIsAssigned() {
        AssignmentRow row = assignOne("נחמיה", "");
        assertThat(row.zoneNumber()).isEqualTo(1);
        assertThat(row.houseNumber()).isNull();
        assertThat(row.routeCode()).isEqualTo("01");
    }

    @Test
    void houseNumberWrittenInTheStreetField() {
        AssignmentRow row = assignOne("חזון איש 42", "");
        assertThat(row.zoneNumber()).isEqualTo(27);
        assertThat(row.houseNumber()).isEqualTo(42);
        assertThat(row.routeCode()).isEqualTo("01-42");
    }

    @Test
    void routeCode_streetOrderInTheZoneAndHouseNumber() {
        AssignmentRow row = assignOne("הגר\"א", "3");
        assertThat(row.zoneNumber()).isEqualTo(45);
        assertThat(row.streetOrder()).isEqualTo(2);
        assertThat(row.routeCode()).isEqualTo("02-03");
    }

    @Test
    void houseLetterKeptSeparately() {
        AssignmentRow row = assignOne("חזון איש", "42א");
        assertThat(row.houseNumber()).isEqualTo(42);
        assertThat(row.houseSuffix()).isEqualTo("א");
    }

    @Test
    void cityWrittenDifferentlyIsStillTheGemachCity() {
        Recipients abbreviation = recipient("קיצור", "ב\"ב", "חזון איש", "42");
        Recipients hyphen = recipient("מקף", "בני-ברק", "חזון איש", "44");
        AssignmentResult result = assignmentService.assignRecipients(PHONE);
        assertThat(rowOf(result, abbreviation).zoneNumber()).isEqualTo(27);
        assertThat(rowOf(result, hyphen).zoneNumber()).isEqualTo(27);
    }

    // ---- הסדר בתוך שקית ----

    private List<String> orderOfZone(int zone) {
        return assignmentService.assignRecipients(PHONE).rows().stream()
                .filter(row -> row.zoneNumber() != null && row.zoneNumber() == zone)
                .map(row -> row.recipient().getStreet() + " " + row.recipient().getHouseNo())
                .toList();
    }

    @Test
    void orderInZone_byStreetOrderThenHouseNumber() {
        recipient("א", "בני ברק", "ורנר", "2");
        recipient("ב", "בני ברק", "נחמיה", "10");
        recipient("ג", "בני ברק", "נחמיה", "3");
        recipient("ד", "בני ברק", "נחמיה", "7");

        assertThat(orderOfZone(1)).containsExactly("נחמיה 3", "נחמיה 7", "נחמיה 10", "ורנר 2");
    }

    @Test
    void orderInZone_houseLetters_andNoHouseNumberFirst() {
        recipient("א", "בני ברק", "נחמיה", "12א");
        recipient("ב", "בני ברק", "נחמיה", "12");
        recipient("ג", "בני ברק", "נחמיה", "");

        assertThat(orderOfZone(1)).containsExactly("נחמיה ", "נחמיה 12", "נחמיה 12א");
    }

    @Test
    void routeSequence_numberedWithinEachZone() {
        recipient("א", "בני ברק", "נחמיה", "4");
        recipient("ב", "בני ברק", "נחמיה", "3");
        Recipients other = recipient("ג", "בני ברק", "חזון איש", "42");

        AssignmentResult result = assignmentService.assignRecipients(PHONE);

        assertThat(result.rows().stream().filter(r -> Integer.valueOf(1).equals(r.zoneNumber())))
                .extracting(AssignmentRow::routeSequence).containsExactly(1, 2);
        assertThat(rowOf(result, other).routeSequence()).isEqualTo(1);
    }

    // ---- כתובות שלא שויכו ----

    @Test
    void unknownStreet() {
        AssignmentRow row = assignOne("בעש\"ט", "5");
        assertThat(row.zoneNumber()).isNull();
        assertThat(row.unassignedReason()).isEqualTo(UnassignedReason.UNKNOWN_STREET);
        assertThat(row.routeCode()).isNull();
        assertThat(row.routeSequence()).isNull();
    }

    @Test
    void houseOutOfRange() {
        assertThat(assignOne("רבי עקיבא", "70").unassignedReason()).isEqualTo(UnassignedReason.HOUSE_OUT_OF_RANGE);
        assertThat(assignOne("רבי עקיבא", "5").unassignedReason()).isEqualTo(UnassignedReason.HOUSE_OUT_OF_RANGE);
    }

    @Test
    void splitStreetWithoutHouseNumber() {
        assertThat(assignOne("חזון איש", "").unassignedReason()).isEqualTo(UnassignedReason.MISSING_HOUSE_NUMBER);
    }

    @Test
    void otherCity() {
        Recipients r = recipient("ירושלמי", "ירושלים", "חזון איש", "42");
        assertThat(rowOf(assignmentService.assignRecipients(PHONE), r).unassignedReason()).isEqualTo(UnassignedReason.OTHER_CITY);
    }

    @Test
    void missingAddress() {
        Recipients noStreet = recipient("בלי רחוב", "בני ברק", "", "4");
        Recipients noCity = recipient("בלי עיר", null, "חזון איש", "42");
        AssignmentResult result = assignmentService.assignRecipients(PHONE);
        assertThat(rowOf(result, noStreet).unassignedReason()).isEqualTo(UnassignedReason.MISSING_ADDRESS);
        assertThat(rowOf(result, noCity).unassignedReason()).isEqualTo(UnassignedReason.MISSING_ADDRESS);
    }

    // ---- התוצאה ----

    @Test
    void resultSortedByZoneAndRoute_unassignedLast() {
        recipient("ג", "בני ברק", "בעש\"ט", "1");
        recipient("ב", "בני ברק", "חזון איש", "44");
        recipient("א", "בני ברק", "חזון איש", "42");
        recipient("ד", "בני ברק", "השל\"ה", "8");

        AssignmentResult result = assignmentService.assignRecipients(PHONE);

        assertThat(result.assigned()).isEqualTo(3);
        assertThat(result.unassigned()).isEqualTo(1);
        assertThat(result.rows()).extracting(row -> row.recipient().getMan()).containsExactly("א", "ב", "ד", "ג");
    }

    @Test
    void recipientsAreNotChanged() {
        Recipients r = recipient("לא משתנה", "בני ברק", "חזו\"א", "42");
        assignmentService.assignRecipients(PHONE);

        Recipients after = recipientsRepository.findById(r.getHashCode()).orElseThrow();
        assertThat(after.getStreet()).isEqualTo("חזו\"א");
        assertThat(after.getHouseNo()).isEqualTo("42");
        assertThat(after.getCity()).isEqualTo("בני ברק");
    }

    @Test
    void unknownPhone() {
        assertThatThrownBy(() -> assignmentService.assignRecipients("0000000000")).isInstanceOf(NoSuchElementException.class);
    }

    // שלב 1 (לפני החיבור לפרונט): מדפיס לקונסול את ה-JSON המלא שנקודת הגישה מחזירה -
    // בדיוק מה שהפרונט יקבל - כדי לראות מה השיוך עושה. נמען מכל סוג: משויכים (כולל אותה
    // שקית בשני רחובות), ולא משויכים מכל סיבה
    @Test
    void printsTheJsonTheFrontendReceives() throws Exception {
        recipient("משה", "בני ברק", "חזון איש", "42");
        recipient("אהרן", "בני ברק", "חזו\"א", "44");
        recipient("דוד", "בני ברק", "נחמיה", "8");
        recipient("יוסף", "בני ברק", "ורנר", "6");
        recipient("יעקב", "בני ברק", "ר' עקיבא 69", "");
        recipient("שמעון", "בני ברק", "בעש\"ט", "5");
        recipient("לוי", "בני ברק", "רבי עקיבא", "70");
        recipient("יהודה", "בני ברק", "חזון איש", "");
        recipient("נתן", "ירושלים", "חזון איש", "42");
        recipient("גד", null, "נחמיה", "8");

        String json = mockMvc.perform(get("/api/distribution/assignments").param("phone", PHONE))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        com.fasterxml.jackson.databind.JsonNode tree = new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
        // UTF-8 במפורש - אחרת ב-Windows העברית מודפסת בקידוד הישן ויוצאת סימני שאלה
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, java.nio.charset.StandardCharsets.UTF_8);
        out.println("===== GET /api/distribution/assignments?phone=" + PHONE + " - ה-JSON שהפרונט יקבל =====");
        out.println(tree.toPrettyString());
        out.println("===== סיכום קריא (נבנה בטסט בלבד, לא חלק מה-JSON) =====");
        for (com.fasterxml.jackson.databind.JsonNode row : tree.get("rows")) {
            out.println(summaryLine(row));
        }
        out.println("===== סוף ה-JSON =====");

        assertThat(json).contains("\"assigned\":5").contains("\"unassigned\":5");
    }

    // הסיבות בעברית - רק להדפסה הקריאה בטסט. הבקאנד מחזיר קוד בלבד; בפרונט הטקסט יהיה ב-HardCodePage
    private static final java.util.Map<String, String> REASON_IN_HEBREW = java.util.Map.of(
            "MISSING_ADDRESS", "כתובת חסרה",
            "OTHER_CITY", "עיר אחרת",
            "UNKNOWN_STREET", "רחוב לא מוכר",
            "HOUSE_OUT_OF_RANGE", "מספר בית מחוץ לטווח",
            "MISSING_HOUSE_NUMBER", "חסר מספר בית (רחוב מפוצל)"
    );

    // שורה לנמען: שם | כתובת | השקית והמסלול, או למה לא שויך
    private static String summaryLine(com.fasterxml.jackson.databind.JsonNode row) {
        com.fasterxml.jackson.databind.JsonNode r = row.get("recipient");
        String city = r.get("city").isNull() ? "(בלי עיר)" : r.get("city").asText();
        String address = (r.get("street").asText() + " " + r.get("houseNo").asText()).trim() + ", " + city;
        String result = row.get("zoneNumber").isNull()
                ? "לא שויך: " + REASON_IN_HEBREW.get(row.get("unassignedReason").asText())
                : "שקית " + row.get("zoneNumber").asInt() + " (" + row.get("carrierName").asText() + ")"
                        + ", קוד מסלול " + row.get("routeCode").asText()
                        + ", מקום " + row.get("routeSequence").asInt() + " בשקית";
        return r.get("man").asText() + " | " + address + " | " + result;
    }

    @Test
    void endpoint() throws Exception {
        recipient("א", "בני ברק", "חזון איש", "42");
        recipient("ב", "בני ברק", "בעש\"ט", "1");

        mockMvc.perform(get("/api/distribution/assignments").param("phone", PHONE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assigned").value(1))
                .andExpect(jsonPath("$.unassigned").value(1))
                .andExpect(jsonPath("$.rows[0].zoneNumber").value(27))
                .andExpect(jsonPath("$.rows[0].carrierName").value("אחראית 27"))
                .andExpect(jsonPath("$.rows[0].routeCode").value("01-42"))
                .andExpect(jsonPath("$.rows[0].routeSequence").value(1))
                .andExpect(jsonPath("$.rows[0].recipient.man").value("א"))
                .andExpect(jsonPath("$.rows[0].unassignedReason").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.rows[1].unassignedReason").value("UNKNOWN_STREET"));

        mockMvc.perform(get("/api/distribution/assignments").param("phone", "0000000000"))
                .andExpect(status().isNotFound());
    }
}
