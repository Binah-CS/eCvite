-- נתוני התחלה עבור טבלת excel_columns (התאמת עמודות אוטומטית בייבוא Excel).
-- קובץ זה לא רץ אוטומטית עם עליית השרת - זהו רק תיעוד/גיבוי בגרסה (git) של הנתונים שהוזנו ל-Neon,
-- כדי שהצוות יוכל לראות ולבקר אותם. להרצה ידנית בלבד, מול הטבלה שכבר קיימת ב-Neon (excel_columns).

INSERT INTO excel_columns (technical_name, display_name, is_required, default_order, is_visible, aliases) VALUES
('prefix', 'קידומת', false, 1, true, 'קידומת,prefix,תואר'),
('man', 'בעל', false, 2, true, 'בעל,man,חתן,שם בעל,שם פרטי'),
('woman', 'אישה', false, 3, true, 'אישה,woman,כלה,שם אישה'),
('lastName', 'שם משפחה', false, 4, true, 'שם משפחה,last_name,lastname,משפחה,surname'),
('suffix', 'סיומת', false, 5, true, 'סיומת,suffix'),
('fatherName', 'שם האב', false, 6, true, 'שם האב,father_name,אבא,שם אבא'),
('motherName', 'שם האם', false, 7, true, 'שם האם,mother_name,אמא,שם אמא'),
('phone', 'טלפון', false, 8, true, 'טלפון,phone,נייד,טלפון נייד,מספר טלפון'),
('mail', 'מייל', false, 9, true, 'מייל,email,אימייל,כתובת מייל'),
('country', 'מדינה', false, 10, true, 'מדינה,country'),
('city', 'עיר', false, 11, true, 'עיר,city,ישוב'),
('street', 'רחוב', false, 12, true, 'רחוב,street'),
('houseNo', 'מס'' בית', false, 13, true, 'מספר בית,מס'' בית,house_no,house number,בית'),
('belongsTo', 'שייך ל', false, 14, true, 'שייך ל,belongs_to'),
('display', 'תצוגה', false, 15, true, 'תצוגה,display,שם לתצוגה'),
