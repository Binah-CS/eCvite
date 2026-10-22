import api from '../services/api';

// העדפות התצוגה של הטבלה של המשתמשת המחוברת (כרגע רק pageSize - "שורות בעמוד"). נשמרות
// בשרת אצלה (User.tablePreferences) ולא בדפדפן - בכל מחשב ובכל כניסה חדשה הטבלה נפתחת
// עם מה שבחרה (#90). בדיוק כמו labelPrintSettings: אובייקט ריק אם עוד לא בחרה אף
// פעם, או אם הערך השמור לא תקין
export function loadTablePreferences() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || 'null');
    const parsed = user?.tablePreferences ? JSON.parse(user.tablePreferences) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// מעדכנת העדפה (למשל { pageSize: 50 }) ושומרת את כולן בשרת ובעותק המשתמשת שב-sessionStorage.
// ה-sessionStorage מתעדכן מיד (רענון או מעבר דף לא מאפסים את הבחירה גם לפני תשובת השרת),
// ותשובת השרת לא נכתבת עליו בחזרה - כך שתשובה מאוחרת של שמירה קודמת לא דורסת בחירה
// חדשה יותר. אם לא השתנה כלום - לא פונים לשרת. כשל בשרת רק נרשם בקונסול
export async function saveTablePreferences(changes) {
  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (err) {
    console.error('לא ניתן לשמור את העדפות הטבלה - פרטי המשתמשת בדפדפן פגומים:', err);
    return;
  }
  if (!user?.phone) return;

  const tablePreferences = JSON.stringify({ ...loadTablePreferences(), ...changes });
  if (tablePreferences === user.tablePreferences) return;

  sessionStorage.setItem('user', JSON.stringify({ ...user, tablePreferences }));
  try {
    await api.updateTablePreferences(user.phone, tablePreferences);
  } catch (err) {
    console.error('שמירת העדפות הטבלה בשרת נכשלה - הן יישמרו רק עד סוף ההתחברות הנוכחית:', err);
  }
}
