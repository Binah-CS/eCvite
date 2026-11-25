// שמירה של הגדרות המעטפה, בשתי רמות:
// - פרטי השולחים: ב-localStorage, בנפרד לכל משתמשת (לפי טלפון, כמו records-${phone}
//   ב-DashboardPage). לא מתאפסים לעולם. זה המקום היחיד שנוגע ב-localStorage של המעטפות.
// - כל שאר ההגדרות: רק לחזרה מ"שינוי הגדרות הדפסה", ב-sessionStorage, כמו ערכי saved*
//   של המדבקות. בכל פתיחה אחרת החלון מתחיל מברירות המחדל.
// כל גישה עטופה ב-try/catch - אחסון חסום, מלא או ערך פגום לא יכולים לשבור את ההדפסה
import {
  CORNER_SIDES,
  MAX_SENDERS,
  SENDER_FIELDS,
  SENDER_PLACEMENTS,
  createDefaultEnvelopeSettings,
  createEmptySender,
  isFlapShape,
  isKnownEnvelopeSize,
} from './envelopeFormats';

export const SAVED_ENVELOPE_SETTINGS_KEY = 'savedEnvelopeSettings';

function getSendersStorageKey() {
  let phone = '';
  try {
    phone = JSON.parse(sessionStorage.getItem('user') || 'null')?.phone ?? '';
  } catch {
    phone = '';
  }
  return `envelopeSenders-${phone || 'guest'}`;
}

function sanitizeSender(raw) {
  const sender = createEmptySender();
  SENDER_FIELDS.forEach((field) => {
    if (typeof raw?.[field] === 'string') sender[field] = raw[field];
  });
  return sender;
}

export function loadSavedSenders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getSendersStorageKey()) || 'null');
    const senders = Array.isArray(parsed) ? parsed.slice(0, MAX_SENDERS).map(sanitizeSender) : [];
    return senders.length > 0 ? senders : [createEmptySender()];
  } catch {
    return [createEmptySender()];
  }
}

export function saveSenders(senders) {
  try {
    localStorage.setItem(getSendersStorageKey(), JSON.stringify(senders));
  } catch (err) {
    console.error('שמירת פרטי השולח בדפדפן נכשלה:', err);
  }
}

function sanitizeSettings(raw) {
  const defaults = createDefaultEnvelopeSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    ...defaults,
    sizeId: isKnownEnvelopeSize(raw.sizeId) ? raw.sizeId : defaults.sizeId,
    customSize: raw.customSize && typeof raw.customSize === 'object'
      ? { ...defaults.customSize, ...raw.customSize }
      : defaults.customSize,
    printSender: typeof raw.printSender === 'boolean' ? raw.printSender : defaults.printSender,
    senderPlacement: SENDER_PLACEMENTS.includes(raw.senderPlacement) ? raw.senderPlacement : defaults.senderPlacement,
    cornerSide: CORNER_SIDES.includes(raw.cornerSide) ? raw.cornerSide : defaults.cornerSide,
    flapDepthMm: raw.flapDepthMm ?? defaults.flapDepthMm,
    flapShape: isFlapShape(raw.flapShape) ? raw.flapShape : defaults.flapShape,
  };
}

// הגדרות המעטפה בלי השולחים (שנשמרים בנפרד) ובלי senderTypography (שעוד לא נבחר בחלון).
// זה מה שנשמר - גם לחזרה מהתצוגה וגם בשרת אצל המשתמשת (ר' saveEnvelopePrintSettings)
export function toStoredEnvelopeSettings(settings) {
  const { senders, senderTypography, ...rest } = settings ?? {};
  return rest;
}

// נקרא רק ב"שינוי הגדרות הדפסה". השולחים לא כאן, כי הם כבר שמורים בנפרד
export function saveEnvelopeSettingsForReturn(settings) {
  try {
    sessionStorage.setItem(SAVED_ENVELOPE_SETTINGS_KEY, JSON.stringify(toStoredEnvelopeSettings(settings)));
  } catch (err) {
    console.error('שמירת הגדרות המעטפה לחזרה מהתצוגה נכשלה:', err);
  }
}

// ההגדרות שהחלון נפתח איתן: בחזרה מהתצוגה המקדימה - מה שנשמר לפני היציאה אליה; אחרת
// הבחירה השמורה של המשתמשת בשרת (saved, החלק envelope של הבחירות השמורות); ובלי אף אחד
// מהם - ברירות המחדל. ערך לא תקין מוחלף בברירת המחדל שלו. בכל המקרים עם השולחים השמורים,
// כך שהשדות כבר מלאים כשמסמנים הדפסת שולח
export function loadInitialEnvelopeSettings({ returning = false, saved = null } = {}) {
  let fromPreview = null;
  if (returning) {
    try {
      fromPreview = JSON.parse(sessionStorage.getItem(SAVED_ENVELOPE_SETTINGS_KEY) || 'null');
    } catch {
      fromPreview = null;
    }
  }
  return { ...sanitizeSettings(fromPreview ?? saved), senders: loadSavedSenders() };
}
