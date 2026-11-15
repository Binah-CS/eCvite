package com.example.excelapp.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateAccountRequest {

    // זיהוי המשתמשת - טלפון ו-hashCode חייבים להתאים לאותה רשומה (ר' UserService.findAccount)
    private String phone;
    private String hashCode;

    // רק השדות שהשתנו: שם שדה -> ערך חדש. מותרים רק שדות מ-AccountFields.EDITABLE
    private Map<String, String> account;
}
