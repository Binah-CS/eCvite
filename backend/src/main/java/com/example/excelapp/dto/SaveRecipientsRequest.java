package com.example.excelapp.dto;



import com.example.excelapp.entity.Recipients;
import lombok.Data;

import java.util.List;

@Data
public class SaveRecipientsRequest {

    private String phone;

    private List<Recipients> recipients;

    // אופציונלי - hash-ים למחיקה (ניתוק) לפני השמירה, באותה בקשה ואותה טרנזקציה.
    // מאפשר לשלוח מחיקה+שמירה כבקשת HTTP אחת (למשל אחרי פתרון שורות כפולות)
    // במקום שתי בקשות רשת נפרדות לגמרי - ר' RecipientController.saveRecipients
    private List<String> hashCodesToDelete;
}
