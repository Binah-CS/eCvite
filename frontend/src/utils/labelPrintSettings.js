import api from '../services/api';
import { isFontWeight } from '../fonts/fonts';

export const SAVED_FONT_WEIGHT_KEY = 'savedFontWeight';

// אורך מקסימלי לפנייה מותאמת באנגלית. בלי תקרה פנייה ארוכה הייתה מנפחת את הבחירות
// השמורות מעבר לאורך העמודה בשרת, והשמירה כולה הייתה נדחית
export const MAX_ENGLISH_SALUTATION_LENGTH = 40;

// "שינוי הגדרות הדפסה" (מדבקות ומעטפות): העובי נשמר לחזרה רק אם המשתמשת בחרה אותו במפורש.
// בלי בחירה (null) לא נשמר כלום - כך החלון ממשיך לתת את ברירת המחדל של סוג ההדפסה (ר'
// resolveFontWeight), גם אם עוברים בינתיים ממדבקות למעטפות או להפך
export function saveFontWeightForReturn(choice) {
  if (isFontWeight(choice)) sessionStorage.setItem(SAVED_FONT_WEIGHT_KEY, choice);
  else sessionStorage.removeItem(SAVED_FONT_WEIGHT_KEY);
}

// הבחירות האחרונות של המשתמשת המחוברת בחלון ההדפסה, לכל סוג הדפסה בנפרד (נשמרות בשרת
// אצלה, בשדה של User - בדיוק כמו columnPreferences לתצוגת הטבלה). אותו מנגנון לשני
// הסוגים, רק שדה וקריאת שרת אחרים. לא לבלבל עם דגל ההדפסה של כל נמען (האם להדפיס אותו)
function createUserPrintSettings(userField, sendToServer) {
  // אובייקט ריק אם עוד לא בחרה אף פעם, אם הערך השמור לא תקין, או אם ה-user ב-sessionStorage
  // נשמר לפני שהשדה נוסף (התחברות לפני העדכון)
  const load = () => {
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || 'null');
      const parsed = user?.[userField] ? JSON.parse(user[userField]) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  // שומרת את הבחירות בשרת אצל המשתמשת ובעותק המשתמשת שב-sessionStorage. ה-sessionStorage
  // מתעדכן מיד (לפני תשובת השרת), ותשובת השרת לא נכתבת עליו בחזרה - כך שתשובה מאוחרת
  // של שמירה קודמת לא יכולה לדרוס בחירה חדשה יותר. אם לא השתנה כלום - לא פונים לשרת.
  // כשל בשרת לא חוסם את ההדפסה - הבחירה פשוט לא תיזכר במחשב אחר (ונרשם בקונסול)
  const save = async (settings) => {
    let user;
    try {
      user = JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch (err) {
      console.error('לא ניתן לשמור את בחירות ההדפסה - פרטי המשתמשת בדפדפן פגומים:', err);
      return;
    }
    if (!user?.phone) return;

    const value = JSON.stringify(settings);
    if (value === user[userField]) return;

    sessionStorage.setItem('user', JSON.stringify({ ...user, [userField]: value }));
    try {
      await sendToServer(user.phone, value);
    } catch (err) {
      console.error('שמירת בחירות ההדפסה בשרת נכשלה - הן יישמרו רק עד סוף ההתחברות הנוכחית:', err);
    }
  };

  return { load, save };
}

const labelStore = createUserPrintSettings('labelPrintSettings', (phone, value) => api.updateLabelPrintSettings(phone, value));
const envelopeStore = createUserPrintSettings('envelopePrintSettings', (phone, value) => api.updateEnvelopePrintSettings(phone, value));

export const loadLabelPrintSettings = labelStore.load;
export const saveLabelPrintSettings = labelStore.save;
export const loadEnvelopePrintSettings = envelopeStore.load;
export const saveEnvelopePrintSettings = envelopeStore.save;
