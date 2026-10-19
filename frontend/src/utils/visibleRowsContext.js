import { createContext } from 'react';

// ref שהטבלה (DataTable) כותבת אליו את השורות שהיא מציגה עכשיו אחרי חיפוש/סינון, או
// null כשאין סינון - כדי שהדפסה בלי שורות מסומנות תדפיס רק את מה שמוצג. ref ולא state:
// כך כל הקשה בטבלה לא מרנדרת מחדש את כל הדשבורד, והערך נקרא רק כשחלון ההדפסה נפתח
export const VisibleRowsContext = createContext(null);
