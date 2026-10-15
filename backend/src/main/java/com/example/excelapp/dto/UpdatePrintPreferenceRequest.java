package com.example.excelapp.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdatePrintPreferenceRequest {
    private String phone;
    private List<String> recipientHashCodes;
    private boolean printEnabled;
}
