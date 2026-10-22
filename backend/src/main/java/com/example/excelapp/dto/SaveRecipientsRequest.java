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

    // אופציונלי - הסדר המלא של הטבלה אצל המשתמשת, מהשורה הראשונה לאחרונה. לנמען קיים -
    // ה-hashCode שלו; לשורה חדשה שעוד אין לה hash - "#" ואחריו המקום שלה ב-recipients
    // של הבקשה הזו (למשל "#0"). נשלח רק כשהסדר השתנה או כשיש שורות חדשות
    private List<String> order;
}
