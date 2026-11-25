// הבחירות בחלון ההדפסה שמשותפות במבנה למדבקות ולמעטפות (כתב, גודל ועובי, ריווח, מדפסת,
// פנייה, "לכבוד" וכו'). לכל סוג הדפסה ערכים שמורים משלו (ר' labelPrintSettings.js), אבל
// אותו חישוב בדיוק: כל בחירה נלקחת, לפי הסדר, מ-
//   1. החזרה מהתצוגה המקדימה ("שינוי הגדרות הדפסה", ב-sessionStorage)
//   2. הבחירה השמורה של סוג ההדפסה הנוכחי
//   3. הבחירה השמורה של הסוג השני - כך שסוג שעוד לא הודפס אף פעם מתחיל ממה שהמשתמשת
//      כבר בחרה בסוג השני
//   4. ברירת המחדל
// לכל מפתח בנפרד, כך שגם שמירה ישנה שחסר בה מפתח (למשל letterSpacing) משלימה אותו נכון.
// ערך לא תקין (כמו "printer1" מגרסה קודמת, או כתב שכבר לא ברשימה) מדולג.
// גודל הכתב מוחזר כמספר בלי תקרה - התקרה תלויה בסוג ההדפסה, והחלון מחיל אותה
import {
  DEFAULT_FONT_ID,
  DEFAULT_LETTER_SPACING,
  isFontWeight,
  isLetterSpacing,
  normalizeEnglishFontId,
  normalizeFontId,
  normalizeFontPair,
} from '../fonts/fonts';
import { FONT_SCALE_DEFAULT } from './labelSheetLayout';
import { MAX_ENGLISH_SALUTATION_LENGTH } from './labelPrintSettings';

export const GREETING_ALIGNMENTS = ['right', 'center', 'left'];

const isBooleanString = (v) => v === 'true' || v === 'false';

// [מפתח, מפתח החזרה מהתצוגה, בדיקת תקינות (על מחרוזת), ברירת מחדל (מחרוזת או null)]
const CHOICES = [
  ['fontType', 'savedFontType', (v) => normalizeFontId(v, null) !== null, DEFAULT_FONT_ID],
  ['englishFontType', 'savedEnglishFontType', (v) => v === '' || normalizeEnglishFontId(v) !== '', ''],
  ['printer', 'savedPrinter', (v) => v === 'home' || v === 'office', 'home'],
  ['deliveryMethod', 'savedDeliveryMethod', (v) => v === 'courier' || v === 'pickup', 'courier'],
  ['fontScale', 'savedFontScale', (v) => v.trim() !== '' && Number.isFinite(Number(v)), String(FONT_SCALE_DEFAULT)],
  // null = לא נבחר עובי: העובי בפועל הוא ברירת המחדל של סוג ההדפסה (ר' resolveFontWeight)
  ['fontWeight', 'savedFontWeight', isFontWeight, null],
  ['letterSpacing', 'savedLetterSpacing', isLetterSpacing, DEFAULT_LETTER_SPACING],
  ['englishSalutation', 'savedEnglishSalutation', () => true, ''],
  ['emptyLineWhenNoAddress', 'savedEmptyLineWhenNoAddress', isBooleanString, 'true'],
  ['greetingShow', 'savedGreetingShow', isBooleanString, 'true'],
  ['greetingSeparateLine', 'savedGreetingSeparateLine', isBooleanString, 'true'],
  ['greetingAlign', 'savedGreetingAlign', (v) => GREETING_ALIGNMENTS.includes(v), 'center'],
];

// מפתחות החזרה מהתצוגה המקדימה של הבחירות האלה - כדי שהחלון ימחק את כולם אחרי הקריאה
export const RETURN_CHOICE_KEYS = CHOICES.map(([, sessionKey]) => sessionKey);

export function clampEnglishSalutation(value) {
  return String(value ?? '').slice(0, MAX_ENGLISH_SALUTATION_LENGTH);
}

function pick(sessionValue, sources, prefKey, isValid, fallback) {
  if (sessionValue !== null && sessionValue !== undefined && isValid(sessionValue)) return sessionValue;
  for (const source of sources) {
    const value = source?.[prefKey];
    if (value !== undefined && value !== null && isValid(String(value))) return String(value);
  }
  return fallback;
}

// session - קורא מפתח מהחזרה מהתצוגה המקדימה (null = אין); primary / fallback - הבחירות
// השמורות של הסוג הנוכחי ושל הסוג השני (אובייקט ריק אם אין)
export function resolveInitialChoices({ session = () => null, primary = {}, fallback = {} } = {}) {
  const sources = [primary, fallback];
  const raw = Object.fromEntries(CHOICES.map(([key, sessionKey, isValid, defaultValue]) => {
    let sessionValue = null;
    try {
      sessionValue = session(sessionKey);
    } catch {
      sessionValue = null;
    }
    return [key, pick(sessionValue, sources, key, isValid, defaultValue)];
  }));

  // שני הכתבים יחד: כתב בלי עברית שנשמר פעם כראשי עובר לשדה האנגלית
  const { fontType, englishFontType } = normalizeFontPair(raw.fontType, raw.englishFontType);
  return {
    ...raw,
    fontType,
    englishFontType,
    fontScale: Number(raw.fontScale),
    englishSalutation: clampEnglishSalutation(raw.englishSalutation),
    emptyLineWhenNoAddress: raw.emptyLineWhenNoAddress === 'true',
    greetingShow: raw.greetingShow === 'true',
    greetingSeparateLine: raw.greetingSeparateLine === 'true',
  };
}
