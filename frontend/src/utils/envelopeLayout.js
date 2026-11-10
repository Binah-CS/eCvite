// חישוב הפריסה של מעטפה במילימטרים - פונקציות טהורות, בלי React ובלי DOM. הרינדור
// (EnvelopeSheet) רק עובר על מה שמוחזר מכאן, ולכן מצב שולח חדש לא משנה אותו.
//
// התוצאה היא רשימת "מעברים" (passes): כל מעבר הוא דף אחד שעובר במדפסת לכל נמען.
// none ו-openFlap צריכים מעבר אחד; הדפסה בשני מעברים (twoPass) תחזיר שניים.
import { LABEL_LINE_HEIGHT, FONT_SCALE_MIN, FONT_SCALE_DEFAULT, FONT_SCALE_STEP } from './labelSheetLayout';
import {
  FLAP_SHAPES,
  MAX_SENDERS,
  MM_TO_PX,
  isSenderComplete,
  isValidFlapDepth,
  resolveEnvelopeDimensions,
} from './envelopeFormats';

const MIN_MARGIN_MM = 5; // האזור שרוב המדפסות לא מדפיסות בו
const MARGIN_RATIO = 0.05; // שוליים שגדלים עם המעטפה
const FOLD_GAP_MM = 3; // מרחק הטקסט מקו הקיפול
const SENDER_COLUMN_GAP_MM = 4;
const TRIANGLE_SIDE_INSET_MM = 2;

const REFERENCE_HEIGHT_MM = 133; // גובה המעטפה הסטנדרטית, שלפיו נקבע גודל הכתב הבסיסי
const BASE_NAME_PX = 18;
const BASE_LINE_PX = 15;
const MIN_FONT_RATIO = 0.6;
const MAX_FONT_RATIO = 1.4;
const NAME_LINE_MARGIN_PX = 2;
const REFERENCE_LINES_UNDER_NAME = 3; // כתובת, עיר ומיקוד, ארץ
const ENVELOPE_FONT_SCALE_MAX = 200; // התקרה לפי גובה לא מתחשבת ברוחב השורה

export const SENDER_FONT_FACTOR = 0.8;

export function getEnvelopeMargin({ widthMm, heightMm }) {
  return Math.max(MIN_MARGIN_MM, Math.min(widthMm, heightMm) * MARGIN_RATIO);
}

function getEnvelopeFontBase(heightMm) {
  const ratio = Math.min(MAX_FONT_RATIO, Math.max(MIN_FONT_RATIO, heightMm / REFERENCE_HEIGHT_MM));
  return { name: BASE_NAME_PX * ratio, line: BASE_LINE_PX * ratio };
}

// המקסימום שבו שם + 3 שורות עדיין נכנסים בגובה החזית
export function getMaxEnvelopeFontScale(dimensions) {
  if (!dimensions) return FONT_SCALE_DEFAULT;
  const base = getEnvelopeFontBase(dimensions.heightMm);
  const availablePx = (dimensions.heightMm - 2 * getEnvelopeMargin(dimensions)) * MM_TO_PX - NAME_LINE_MARGIN_PX;
  const contentPx = LABEL_LINE_HEIGHT * (base.name + REFERENCE_LINES_UNDER_NAME * base.line);
  const max = Math.floor(((availablePx / contentPx) * 100) / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(ENVELOPE_FONT_SCALE_MAX, Math.max(FONT_SCALE_DEFAULT, max));
}

export function clampEnvelopeFontScale(scale, dimensions) {
  const value = Number.isFinite(Number(scale)) ? Number(scale) : FONT_SCALE_DEFAULT;
  return Math.min(Math.max(value, FONT_SCALE_MIN), getMaxEnvelopeFontScale(dimensions));
}

export function getRecipientTypography(dimensions, { fontType, fontScale, fontWeight } = {}) {
  const base = getEnvelopeFontBase(dimensions.heightMm);
  const factor = clampEnvelopeFontScale(fontScale, dimensions) / 100;
  return {
    fontFamily: fontType,
    fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
    namePx: base.name * factor,
    linePx: base.line * factor,
  };
}

// המקום היחיד שקובע את כתב השולח. היום: הכתב של הנמען בהקטנה קבועה. הגדרות נפרדות
// לשולח בעתיד יגיעו דרך override (settings.senderTypography) בלי לשנות שום מקום אחר
export function resolveSenderTypography(recipientTypography, override = null) {
  return {
    ...recipientTypography,
    namePx: recipientTypography.namePx * SENDER_FONT_FACTOR,
    linePx: recipientTypography.linePx * SENDER_FONT_FACTOR,
    ...(override || {}),
  };
}

function rectanglePoints(x, y, width, height) {
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
}

function recipientBlock(dimensions, offsetY) {
  const margin = getEnvelopeMargin(dimensions);
  return {
    role: 'recipient',
    rotationDeg: 0,
    rect: {
      x: margin,
      y: offsetY + margin,
      width: dimensions.widthMm - 2 * margin,
      height: dimensions.heightMm - 2 * margin,
    },
  };
}

function layoutRecipientOnly({ dimensions }) {
  const { widthMm, heightMm } = dimensions;
  return {
    passes: [{
      id: 'main',
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
      blocks: [recipientBlock(dimensions, 0)],
      guides: [{ points: rectanglePoints(0, 0, widthMm, heightMm), closed: true, dashed: false }],
    }],
    finishedViews: null,
  };
}

// גובה שורות השולח: שם + 3 שורות בכתב של השולח
function estimateSenderHeightMm(typography) {
  return (LABEL_LINE_HEIGHT * (typography.namePx + REFERENCE_LINES_UNDER_NAME * typography.linePx)) / MM_TO_PX + 1;
}

// השטח הבטוח לשולח על הלשונית, בקואורדינטות הדף הפתוח (הלשונית בראש הדף, הקיפול ב-y=depth).
// בלשונית משולשת הרוחב במרחק d מהקיפול הוא W*(1-d/D), ולכן הטקסט צמוד לקיפול
function senderRect({ dimensions, flapDepthMm, flapShape, senderTypography }) {
  const { widthMm } = dimensions;
  const margin = getEnvelopeMargin(dimensions);
  const availableHeight = Math.max(0, flapDepthMm - FOLD_GAP_MM - margin);
  if (flapShape === 'triangular') {
    const height = Math.min(availableHeight, estimateSenderHeightMm(senderTypography));
    const usableWidth = Math.max(
      0,
      widthMm * (1 - (FOLD_GAP_MM + height) / flapDepthMm) - 2 * TRIANGLE_SIDE_INSET_MM,
    );
    return { x: (widthMm - usableWidth) / 2, y: flapDepthMm - FOLD_GAP_MM - height, width: usableWidth, height };
  }
  return { x: margin, y: margin, width: widthMm - 2 * margin, height: availableHeight };
}

// מיקום כל שולח בתוך המיכל, בקואורדינטות של המעטפה הסגורה (כלומר כפי שרואים אותה
// אחרי הקיפול). המיכל כולו מסובב ב-180°, ולכן השולח הראשון, שנמצא כאן בימין, יוצא
// בצד שמאל בפריסה הפתוחה - ובצד ימין על המעטפה הסגורה
function senderItems(rect, senderCount) {
  if (senderCount < 2) {
    return [{ senderIndex: 0, rect: { x: 0, y: 0, width: rect.width, height: rect.height } }];
  }
  const columnWidth = Math.max(0, (rect.width - SENDER_COLUMN_GAP_MM) / 2);
  return [
    { senderIndex: 0, rect: { x: columnWidth + SENDER_COLUMN_GAP_MM, y: 0, width: columnWidth, height: rect.height } },
    { senderIndex: 1, rect: { x: 0, y: 0, width: columnWidth, height: rect.height } },
  ];
}

function flapOutlineOpen(widthMm, depth, shape) {
  return shape === 'triangular'
    ? [[0, depth], [widthMm / 2, 0], [widthMm, depth]]
    : [[0, depth], [0, 0], [widthMm, 0], [widthMm, depth]];
}

function flapOutlineClosed(widthMm, depth, shape) {
  return shape === 'triangular'
    ? [[0, 0], [widthMm / 2, depth], [widthMm, 0]]
    : [[0, 0], [0, depth], [widthMm, depth], [widthMm, 0]];
}

// קיפול הלשונית על הקו y=depth. המלבן נשאר באותו מרחק מהקיפול ומתהפך מימין לשמאל
// כשמסתכלים על גב המעטפה
function foldRectClosed(rect, widthMm, depth) {
  return {
    x: widthMm - rect.x - rect.width,
    y: depth - (rect.y + rect.height),
    width: rect.width,
    height: rect.height,
  };
}

function layoutOpenFlap({ dimensions, flapDepthMm, flapShape, senderCount, senderTypography }) {
  const { widthMm, heightMm } = dimensions;
  const depth = Number(flapDepthMm);
  const rect = senderRect({ dimensions, flapDepthMm: depth, flapShape, senderTypography });
  const items = senderItems(rect, senderCount);
  const recipient = recipientBlock(dimensions, depth);
  const envelopeOutline = rectanglePoints(0, 0, widthMm, heightMm);

  return {
    passes: [{
      id: 'main',
      pageWidthMm: widthMm,
      pageHeightMm: heightMm + depth,
      blocks: [{ role: 'senders', rotationDeg: 180, rect, items }, recipient],
      guides: [
        { points: rectanglePoints(0, depth, widthMm, heightMm), closed: true, dashed: false },
        { points: flapOutlineOpen(widthMm, depth, flapShape), closed: false, dashed: false },
        { points: [[0, depth], [widthMm, depth]], closed: false, dashed: true },
      ],
    }],
    finishedViews: {
      front: {
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        blocks: [recipientBlock(dimensions, 0)],
        guides: [{ points: envelopeOutline, closed: true, dashed: false }],
      },
      back: {
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        blocks: [{ role: 'senders', rotationDeg: 0, rect: foldRectClosed(rect, widthMm, depth), items }],
        guides: [
          { points: envelopeOutline, closed: true, dashed: false },
          { points: flapOutlineClosed(widthMm, depth, flapShape), closed: false, dashed: false },
        ],
      },
    },
  };
}

// מצבי השולח. מצב חדש הוא רשומה חדשה כאן עם פונקציית פריסה משלה
export const SENDER_MODES = {
  none: { usesFlap: false, buildLayout: layoutRecipientOnly },
  openFlap: { usesFlap: true, buildLayout: layoutOpenFlap },
};

export function isEnvelopeSettingsReady(settings) {
  const dimensions = resolveEnvelopeDimensions(settings);
  const mode = SENDER_MODES[settings?.senderMode];
  if (!dimensions || !mode) return false;
  if (!mode.usesFlap) return true;
  const senders = settings.senders ?? [];
  return isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm)
    && FLAP_SHAPES.includes(settings.flapShape)
    && senders.length >= 1
    && senders.length <= MAX_SENDERS
    && senders.every(isSenderComplete);
}

// מחזירה null כשאי אפשר לפרוס (מידות לא תקינות). שולח שעוד לא מולא לא מונע פריסה -
// כך התצוגה מתעדכנת בזמן ההקלדה, והכפתורים נחסמים לפי isEnvelopeSettingsReady
export function buildEnvelopeLayout(settings, textStyle) {
  const dimensions = resolveEnvelopeDimensions(settings);
  const mode = SENDER_MODES[settings?.senderMode];
  if (!dimensions || !mode) return null;
  if (mode.usesFlap && !isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm)) return null;

  const recipientTypography = getRecipientTypography(dimensions, textStyle);
  const senderTypography = resolveSenderTypography(recipientTypography, settings.senderTypography);
  const layout = mode.buildLayout({
    dimensions,
    flapDepthMm: settings.flapDepthMm,
    flapShape: settings.flapShape,
    senderCount: (settings.senders ?? []).length,
    senderTypography,
  });
  return { ...layout, typography: { recipient: recipientTypography, sender: senderTypography } };
}
