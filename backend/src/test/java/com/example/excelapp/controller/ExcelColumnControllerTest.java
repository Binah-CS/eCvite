package com.example.excelapp.controller;

import com.example.excelapp.model.ExcelColumn;
import com.example.excelapp.repository.ExcelColumnRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// @WebMvcTest (לא @SpringBootTest) + @MockBean על ה-repository - לא מול מסד נתונים
// אמיתי בכלל, כי ExcelColumn משתמש בעמודת מערך ספציפית ל-Postgres (text[]) שלא
// ניתן ליצור מול H2 - בודק רק את הלוגיקה של ה-controller עצמו, מבודד מה-DB
@WebMvcTest(ExcelColumnController.class)
class ExcelColumnControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @MockBean
    private ExcelColumnRepository excelColumnRepository;

    private ExcelColumn columnWithAliases(String technicalName, String aliases) {
        return ExcelColumn.builder()
                .id(1L)
                .technicalName(technicalName)
                .displayName("עיר")
                .aliases(aliases)
                .build();
    }

    @Test
    void getColumns_returnsRepositoryResultAsIs() throws Exception {
        when(excelColumnRepository.findAllByOrderByDefaultOrderAsc())
                .thenReturn(List.of(columnWithAliases("city", null)));

        mockMvc.perform(get("/api/recipient-columns"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].technicalName").value("city"));
    }

    @Test
    void addAlias_newAlias_appendsToExistingAndSaves() throws Exception {
        ExcelColumn column = columnWithAliases("city", "City");
        when(excelColumnRepository.findAllByOrderByDefaultOrderAsc()).thenReturn(List.of(column));
        when(excelColumnRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/recipient-columns/city/aliases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("alias", "עיר מגורים"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aliases").value("City,עיר מגורים"));

        verify(excelColumnRepository).save(any());
    }

    @Test
    void addAlias_alreadyPresent_doesNotDuplicateOrSave() throws Exception {
        ExcelColumn column = columnWithAliases("city", "עיר,City");
        when(excelColumnRepository.findAllByOrderByDefaultOrderAsc()).thenReturn(List.of(column));

        mockMvc.perform(post("/api/recipient-columns/city/aliases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("alias", "עיר"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aliases").value("עיר,City"));

        verify(excelColumnRepository, never()).save(any());
    }

    @Test
    void addAlias_blankAlias_doesNotSave() throws Exception {
        ExcelColumn column = columnWithAliases("city", "City");
        when(excelColumnRepository.findAllByOrderByDefaultOrderAsc()).thenReturn(List.of(column));

        mockMvc.perform(post("/api/recipient-columns/city/aliases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("alias", "   "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aliases").value("City"));

        verify(excelColumnRepository, never()).save(any());
    }

    @Test
    void addAlias_unknownTechnicalName_currentlyThrowsUnhandled() {
        // פער ידוע (לא תוקן, רק מתועד): orElseThrow() בלי טיפול משמעו שבקשה לשם
        // טכני לא קיים לא מקבלת תשובת שגיאה מובנת (לא 404, לא הודעה) - זה מתפוצץ
        // כחריגה לא מטופלת (ServletException עוטפת NoSuchElementException). ר'
        // ExcelImport.jsx שרק עושה .catch() שקט על זה בצד הלקוח. אם זה אי-פעם
        // ייתפס ויוחזר כתשובת 404/400 ברורה, הבדיקה הזו תצטרך עדכון
        when(excelColumnRepository.findAllByOrderByDefaultOrderAsc()).thenReturn(List.of());

        ServletException thrown = assertThrows(ServletException.class, () ->
                mockMvc.perform(post("/api/recipient-columns/does-not-exist/aliases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(Map.of("alias", "משהו")))));

        assertThat(thrown.getCause()).isInstanceOf(java.util.NoSuchElementException.class);
    }
}
