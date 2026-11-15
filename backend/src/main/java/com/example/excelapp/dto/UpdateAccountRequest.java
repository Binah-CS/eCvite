package com.example.excelapp.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateAccountRequest {

    // זיהוי המשתמשת - טלפון ו-hashCode חייבים להתאים לאותה רשומה (ר' UserService.findAccount)
    private String phone;
    private String hashCode;

    // רק השדות שהשתנו: שם שדה -> ערך חדש. מותרים רק שדות מ-AccountFields.EDITABLE.
    // null = אין שינוי בפרטי החשבון
    private Map<String, String> account;

    // פרטי השולח המלאים (כל השדות מ-SenderFields), כי יש כללי ולידציה בין שדות.
    // null = אין שינוי בפרטי השולח
    private Map<String, String> sender;
}
