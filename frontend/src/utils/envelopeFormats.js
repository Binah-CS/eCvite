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

// מיקום השולח כשמדפיסים אותו. כל ערך כאן הוא גם מפתח ב-SENDER_MODES (envelopeLayout)
export const SENDER_PLACEMENTS = ['openFlap', 'frontCorner'];
export const DEFAULT_SENDER_PLACEMENT = 'openFlap';

// הצד של השולח בפינה. auto = לפי שפת הנמען של כל מעטפה (ר' resolveCornerSide)
export const CORNER_SIDES = ['auto', 'right', 'left'];
export const DEFAULT_CORNER_SIDE = 'auto';

// המקום היחיד שמתרגם את הבחירות בחלון למצב שולח. ביטול "הדפס גם את פרטי השולח" לא
// נוגע במיקום, כך שסימון מחדש מחזיר את מה שנבחר קודם
export function getSenderMode(settings) {
  if (!settings?.printSender) return 'none';
  return SENDER_PLACEMENTS.includes(settings.senderPlacement) ? settings.senderPlacement : DEFAULT_SENDER_PLACEMENT;
}

// אותם שמות שדות כמו אצל הנמען (street, houseNo, city, country). מיקוד קיים רק לשולח
export const SENDER_REQUIRED_FIELDS = ['name', 'street', 'city'];
export const SENDER_FIELDS = [...SENDER_REQUIRED_FIELDS, 'houseNo', 'zip', 'country'];

export function createEmptySender() {
  return Object.fromEntries(SENDER_FIELDS.map((field) => [field, '']));
}

export function isSenderComplete(sender) {
  return SENDER_REQUIRED_FIELDS.every((field) => String(sender?.[field] ?? '').trim() !== '');
}

export function hasSenderDetails(sender) {
  return SENDER_FIELDS.some((field) => String(sender?.[field] ?? '').trim() !== '');
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
    printSender: false,
    senderPlacement: DEFAULT_SENDER_PLACEMENT,
    cornerSide: DEFAULT_CORNER_SIDE,
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

// טווח המידות המותאמות. המינימום מבטיח שהכתב המינימלי תמיד נכנס בגובה (גם עם שולח בפינה
// והרבה שורות לנמען). המקסימום תופס בעיקר הקלדה שגויה (1840 במקום 184)
export const MIN_ENVELOPE_WIDTH_MM = 110;
export const MIN_ENVELOPE_HEIGHT_MM = 80;
export const MAX_ENVELOPE_WIDTH_MM = 350;
export const MAX_ENVELOPE_HEIGHT_MM = 260;

function isInSizeRange(widthMm, heightMm) {
  return widthMm >= MIN_ENVELOPE_WIDTH_MM && widthMm <= MAX_ENVELOPE_WIDTH_MM
    && heightMm >= MIN_ENVELOPE_HEIGHT_MM && heightMm <= MAX_ENVELOPE_HEIGHT_MM;
}

// הסיבה שהמידות המותאמות לא תקינות, או null. הלשונית על הצלע הארוכה, ולכן הרוחב צריך
// להיות לפחות הגובה. swapped: אחרי החלפת הרוחב והגובה המידות היו תקינות
export function getCustomSizeError(customSize) {
  const widthMm = toPositiveNumber(customSize?.widthMm);
  const heightMm = toPositiveNumber(customSize?.heightMm);
  if (!widthMm || !heightMm) return 'invalid';
  if (heightMm > widthMm) return isInSizeRange(heightMm, widthMm) ? 'swapped' : 'portrait';
  if (widthMm < MIN_ENVELOPE_WIDTH_MM || heightMm < MIN_ENVELOPE_HEIGHT_MM) return 'tooSmall';
  if (widthMm > MAX_ENVELOPE_WIDTH_MM || heightMm > MAX_ENVELOPE_HEIGHT_MM) return 'tooLarge';
  return null;
}

// מידות המעטפה בפועל, או null אם המידות המותאמות לא תקינות (ר' getCustomSizeError)
export function resolveEnvelopeDimensions({ sizeId, customSize } = {}) {
  const size = ENVELOPE_SIZES.find((candidate) => candidate.id === sizeId);
  if (size) return { widthMm: size.widthMm, heightMm: size.heightMm };
  if (sizeId !== CUSTOM_ENVELOPE_ID || getCustomSizeError(customSize)) return null;
  return { widthMm: Number(customSize.widthMm), heightMm: Number(customSize.heightMm) };
}

// הלשונית לא יכולה להיות עמוקה יותר מגובה המעטפה שעליה היא נסגרת
export function isValidFlapDepth(flapDepthMm, heightMm) {
  const depth = toPositiveNumber(flapDepthMm);
  return depth !== null && depth <= heightMm;
}
