// מקור אמת יחיד לגדלי המעטפות ולמבנה ההגדרות של הדפסת מעטפה. הוספת גודל חדש היא
// הוספת שורה אחת ל-ENVELOPE_SIZES - כל השאר (הרשימה בחלון, הפריסה, התצוגה) נגזר ממנה.
// כל המידות במילימטרים. הלשונית נמצאת על הצלע הארוכה, ולכן widthMm היא המידה הגדולה.

export const MM_TO_PX = 96 / 25.4;

export const FLAP_SHAPES = ['straight', 'triangular'];
export const DEFAULT_FLAP_SHAPE = 'straight';

export const ENVELOPE_SIZES = [
  { id: 'a7', label: 'סטנדרטית', widthMm: 184, heightMm: 133, defaultFlapDepthMm: 40 },
  { id: 'c6', label: 'קטנה', widthMm: 162, heightMm: 114, defaultFlapDepthMm: 30 },
];

export const CUSTOM_ENVELOPE_ID = 'custom';
export const DEFAULT_CUSTOM_ENVELOPE = { widthMm: 184, heightMm: 133 };
const DEFAULT_CUSTOM_FLAP_DEPTH_MM = 40;

export const MAX_SENDERS = 2;

// אותם שמות שדות כמו אצל הנמען (street, houseNo, city, country). מיקוד קיים רק לשולח
export const SENDER_REQUIRED_FIELDS = ['name', 'street', 'city'];
export const SENDER_FIELDS = [...SENDER_REQUIRED_FIELDS, 'houseNo', 'zip', 'country'];

export function createEmptySender() {
  return Object.fromEntries(SENDER_FIELDS.map((field) => [field, '']));
}

export function isSenderComplete(sender) {
  return SENDER_REQUIRED_FIELDS.every((field) => String(sender?.[field] ?? '').trim() !== '');
}

export function isKnownEnvelopeSize(sizeId) {
  return sizeId === CUSTOM_ENVELOPE_ID || ENVELOPE_SIZES.some((size) => size.id === sizeId);
}

export function getDefaultFlapDepth(sizeId) {
  const size = ENVELOPE_SIZES.find((candidate) => candidate.id === sizeId);
  return size ? size.defaultFlapDepthMm : DEFAULT_CUSTOM_FLAP_DEPTH_MM;
}

export function createDefaultEnvelopeSettings() {
  const sizeId = ENVELOPE_SIZES[0].id;
  return {
    sizeId,
    customSize: { ...DEFAULT_CUSTOM_ENVELOPE },
    senderMode: 'none',
    flapDepthMm: getDefaultFlapDepth(sizeId),
    flapShape: DEFAULT_FLAP_SHAPE,
    senders: [createEmptySender()],
    // שמור להגדרות כתב נפרדות לשולח בעתיד. null = נגזר מהנמען (ר' resolveSenderTypography)
    senderTypography: null,
  };
}

function toPositiveNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// מידות המעטפה בפועל, או null אם המידות המותאמות לא תקינות
export function resolveEnvelopeDimensions({ sizeId, customSize } = {}) {
  const size = ENVELOPE_SIZES.find((candidate) => candidate.id === sizeId);
  if (size) return { widthMm: size.widthMm, heightMm: size.heightMm };
  if (sizeId !== CUSTOM_ENVELOPE_ID) return null;
  const widthMm = toPositiveNumber(customSize?.widthMm);
  const heightMm = toPositiveNumber(customSize?.heightMm);
  return widthMm && heightMm ? { widthMm, heightMm } : null;
}

// הלשונית לא יכולה להיות עמוקה יותר מגובה המעטפה שעליה היא נסגרת
export function isValidFlapDepth(flapDepthMm, heightMm) {
  const depth = toPositiveNumber(flapDepthMm);
  return depth !== null && depth <= heightMm;
}
