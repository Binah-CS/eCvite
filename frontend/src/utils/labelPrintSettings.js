import api from '../services/api';

// הבחירות האחרונות של המשתמשת המחוברת בחלון "הדפסת מדבקות" (נשמרות בשרת אצלה,
// User.labelPrintSettings - בדיוק כמו columnPreferences לתצוגת הטבלה). אובייקט ריק
// אם עוד לא בחרה אף פעם, או אם הערך השמור לא תקין. לא לבלבל עם דגל ההדפסה של כל
// נמען (האם להדפיס אותו) - זה דבר אחר
export function loadLabelPrintSettings() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || 'null');
    const parsed = user?.labelPrintSettings ? JSON.parse(user.labelPrintSettings) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// שומרת את הבחירות בשרת אצל המשתמשת ובעותק המשתמשת שב-sessionStorage. ה-sessionStorage
// מתעדכן מיד (לפני תשובת השרת), ותשובת השרת לא נכתבת עליו בחזרה - כך שתשובה מאוחרת
// של שמירה קודמת לא יכולה לדרוס בחירה חדשה יותר. אם לא השתנה כלום - לא פונים לשרת.
// כשל בשרת לא חוסם את ההדפסה - הבחירה פשוט לא תיזכר במחשב אחר (ונרשם בקונסול)
export async function saveLabelPrintSettings(settings) {
  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (err) {
    console.error('לא ניתן לשמור את בחירות ההדפסה - פרטי המשתמשת בדפדפן פגומים:', err);
    return;
  }
  if (!user?.phone) return;

  const labelPrintSettings = JSON.stringify(settings);
  if (labelPrintSettings === user.labelPrintSettings) return;

  sessionStorage.setItem('user', JSON.stringify({ ...user, labelPrintSettings }));
  try {
    await api.updateLabelPrintSettings(user.phone, labelPrintSettings);
  } catch (err) {
    console.error('שמירת בחירות ההדפסה בשרת נכשלה - הן יישמרו רק עד סוף ההתחברות הנוכחית:', err);
  }
}
