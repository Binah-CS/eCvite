// המקום היחיד שקורא וכותב את הגדרות המעטפה ופרטי השולח. נשמרים ב-localStorage של
// הדפדפן, בנפרד לכל משתמשת (לפי טלפון, כמו records-${phone} ב-DashboardPage). כל גישה
// עטופה ב-try/catch - אחסון חסום, מלא או ערך פגום לא יכולים לשבור את ההדפסה
import {
  FLAP_SHAPES,
  MAX_SENDERS,
  SENDER_FIELDS,
  createDefaultEnvelopeSettings,
  createEmptySender,
  isKnownEnvelopeSize,
} from './envelopeFormats';
import { SENDER_MODES } from './envelopeLayout';

function getStorageKey() {
  let phone = '';
  try {
    phone = JSON.parse(sessionStorage.getItem('user') || 'null')?.phone ?? '';
  } catch {
    phone = '';
  }
  return `envelopePrintSettings-${phone || 'guest'}`;
}

function sanitizeSender(raw) {
  const sender = createEmptySender();
  SENDER_FIELDS.forEach((field) => {
    if (typeof raw?.[field] === 'string') sender[field] = raw[field];
  });
  return sender;
}

function sanitizeSettings(raw) {
  const defaults = createDefaultEnvelopeSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const senders = Array.isArray(raw.senders) ? raw.senders.slice(0, MAX_SENDERS).map(sanitizeSender) : [];
  return {
    ...defaults,
    sizeId: isKnownEnvelopeSize(raw.sizeId) ? raw.sizeId : defaults.sizeId,
    customSize: raw.customSize && typeof raw.customSize === 'object'
      ? { ...defaults.customSize, ...raw.customSize }
      : defaults.customSize,
    senderMode: Object.prototype.hasOwnProperty.call(SENDER_MODES, raw.senderMode) ? raw.senderMode : defaults.senderMode,
    flapDepthMm: raw.flapDepthMm ?? defaults.flapDepthMm,
    flapShape: FLAP_SHAPES.includes(raw.flapShape) ? raw.flapShape : defaults.flapShape,
    senders: senders.length > 0 ? senders : defaults.senders,
  };
}

// מחזירה תמיד הגדרות שאפשר לעבוד איתן. textStyle הוא null כשעוד לא נשמרו בחירות כתב
export function loadEnvelopePrintSettings() {
  try {
    const saved = localStorage.getItem(getStorageKey());
    const parsed = saved ? JSON.parse(saved) : null;
    return {
      settings: sanitizeSettings(parsed?.settings),
      textStyle: parsed?.textStyle && typeof parsed.textStyle === 'object' ? parsed.textStyle : null,
    };
  } catch {
    return { settings: createDefaultEnvelopeSettings(), textStyle: null };
  }
}

export function saveEnvelopePrintSettings(settings, textStyle) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({ settings, textStyle }));
  } catch (err) {
    console.error('שמירת הגדרות המעטפה בדפדפן נכשלה:', err);
  }
}
