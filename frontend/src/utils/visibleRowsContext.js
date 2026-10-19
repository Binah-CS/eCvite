import { createContext } from 'react';

// ref שהטבלה (DataTable) שמה בו פונקציה שמחזירה { rows, filtered }: השורות כמו שהטבלה
// מציגה אותן עכשיו - אחרי חיפוש/סינון ובסדר המיון שלה - והאם יש סינון. כך ההדפסה
// שומרת על הסינון ועל המיון. ref ולא state: כל הקשה בטבלה לא מרנדרת מחדש את כל
// הדשבורד, והפונקציה נקראת רק כשחלון ההדפסה נפתח
export const VisibleRowsContext = createContext(null);
