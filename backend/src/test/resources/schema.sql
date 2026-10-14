-- פונקציית H2 מינימלית שמחליפה את set_config של Postgres (לא קיימת ב-H2 בכלל) -
-- כדי ש-RecipientController.stampCurrentUserForHistory לא ייכשל כשרץ מול מסד
-- הבדיקות. לא נוגעת בקוד הייצור בכלל - תשתית בדיקות בלבד
CREATE ALIAS IF NOT EXISTS SET_CONFIG FOR "com.example.excelapp.testsupport.H2TestFunctions.setConfig";

-- בפרודקשן recipients_history נוצרת ומתמלאת ע"י טריגר ב-Postgres עצמו, שלא קיים
-- בריפו הזה בכלל (רק ב-DB החי) - כאן יוצרים מבנה מינימלי תואם כדי שאפשר יהיה
-- לבדוק את לוגיקת ה-query וה-הרשאות ב-getRecipientHistory (הבדיקות ממלאות שורות
-- לדוגמה ישירות, לא מסתמכות על טריגר שלא קיים בסביבת הבדיקות)
CREATE TABLE IF NOT EXISTS recipients_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_hash_code VARCHAR(255),
    changed_by VARCHAR(255),
    change_date TIMESTAMP,
    operation VARCHAR(50),
    old_data VARCHAR(4000)
);
