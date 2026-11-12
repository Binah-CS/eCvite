// חישוב הפריסה של מעטפה במילימטרים - פונקציות טהורות, בלי React ובלי DOM. הרינדור
// (EnvelopeSheet) רק עובר על מה שמוחזר מכאן, ולכן מצב שולח חדש לא משנה אותו.
//
// התוצאה היא רשימת "מעברים" (passes): כל מעבר הוא דף אחד שעובר במדפסת לכל נמען.
// none, openFlap ו-frontCorner צריכים מעבר אחד; הדפסה בשני מעברים (twoPass) תחזיר שניים.
import { LABEL_LINE_HEIGHT, FONT_SCALE_MIN, FONT_SCALE_DEFAULT, FONT_SCALE_STEP } from './labelSheetLayout';
import {
  FLAP_SHAPES,
  MAX_SENDERS,
  MM_TO_PX,
  getSenderMode,
  hasSenderDetails,
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
const ENVELOPE_FONT_SCALE_MAX = 200; // התקרה לפי גובה לא מתחשבת ברוחב השורה
const SENDER_EXTRA_MM = 1; // תוספת ביטחון לגובה השולח
const SENDER_LIMIT_RECIPIENT_SCALE = 140; // השולח לא גדל מעבר לגודל שלו כשהנמען ב-140%

// כמה שורות יש בבלוק: בגודל שם (שם, "לכבוד" בשורה נפרדת, פנייה באנגלית) ובגודל פרטים.
// לנמען זה נספר מהנמענים בפועל (countRecipientLines ב-EnvelopeSheet), ובלעדיהם זו ההנחה
export const REFERENCE_RECIPIENT_LINES = { nameLines: 1, detailLines: 3 }; // שם, כתובת, עיר, ארץ
export const SENDER_LINES = { nameLines: 1, detailLines: 3 }; // שם, כתובת, עיר ומיקוד, ארץ - המקסימום

export const CORNER_GAP_MM = 4; // הרווח בין השולח בפינה לבין הנמען שמתחתיו
const CORNER_WIDTH_RATIO = 0.45; // החלק מרוחב החזית שהשולח בפינה תופס. השאר נשאר לבול
export const CORNER_MIN_SENDER_WIDTH_MM = 60; // במעטפה צרה, כדי ששורות השולח לא יישברו
export const CORNER_STAMP_MIN_MM = 25; // המקום שתמיד נשאר לבול בפינה הנגדית
const CORNER_BOTTOM_GAP_RATIO = 0.1;

export const SENDER_FONT_FACTOR = 0.8;

export function getEnvelopeMargin({ widthMm, heightMm }) {
  return Math.max(MIN_MARGIN_MM, Math.min(widthMm, heightMm) * MARGIN_RATIO);
}

// במצב הפינה הנמען לא יורד עד השוליים הרגילים בתחתית, אלא שומר רווח גדול יותר
export function getCornerBottomGap(dimensions) {
  return Math.max(getEnvelopeMargin(dimensions), dimensions.heightMm * CORNER_BOTTOM_GAP_RATIO);
}

function getEnvelopeFontBase(heightMm) {
  const ratio = Math.min(MAX_FONT_RATIO, Math.max(MIN_FONT_RATIO, heightMm / REFERENCE_HEIGHT_MM));
  return { name: BASE_NAME_PX * ratio, line: BASE_LINE_PX * ratio };
}

// הגודל המקסימלי של כתב השולח, כגודל שהוא מקבל כשהנמען ב-X% באותה מעטפה. X הוא לכל היותר
// SENDER_LIMIT_RECIPIENT_SCALE, כך שנמען גדול מאוד לא מגדיל את השולח מעבר למה שסביר.
// על הלשונית (flapDepthMm) השולח צריך גם להיכנס בעומק שלה: הלשונית נפרדת מהחזית, ולכן היא
// מגבילה רק את השולח ולא את הנמען. X יורד בצעדים של המונה עד שהשולח נכנס, אבל לא מתחת
// למינימום - שם הגלישה מקבלת אזהרה
export function getSenderTypographyLimit(dimensions, flapDepthMm = null) {
  const base = getEnvelopeFontBase(dimensions.heightMm);
  const senderAt = (scale) => {
    const factor = (scale / 100) * SENDER_FONT_FACTOR;
    return { namePx: base.name * factor, linePx: base.line * factor };
  };
  if (flapDepthMm === null) return senderAt(SENDER_LIMIT_RECIPIENT_SCALE);
  const space = getFlapSenderSpaceMm(dimensions, flapDepthMm);
  for (let scale = SENDER_LIMIT_RECIPIENT_SCALE; scale > FONT_SCALE_MIN; scale -= FONT_SCALE_STEP) {
    if (estimateSenderHeightMm(senderAt(scale)) <= space) return senderAt(scale);
  }
  return senderAt(FONT_SCALE_MIN);
}

function getRecipientTypography(dimensions, { fontType, fontWeight } = {}, scale) {
  const base = getEnvelopeFontBase(dimensions.heightMm);
  return {
    fontFamily: fontType,
    fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
    namePx: (base.name * scale) / 100,
    linePx: (base.line * scale) / 100,
  };
}

// המקום היחיד שקובע את כתב השולח. היום: הכתב של הנמען בהקטנה קבועה, עד limit
// (getSenderTypographyLimit), ולכן תמיד קטן מהנמען. הגופן והעובי מהנמען. הגדרות נפרדות
// לשולח בעתיד יגיעו דרך override (settings.senderTypography) בלי לשנות שום מקום אחר
export function resolveSenderTypography(recipientTypography, override = null, limit = null) {
  const scaled = (px, max) => Math.min(px * SENDER_FONT_FACTOR, max ?? Infinity);
  return {
    ...recipientTypography,
    namePx: scaled(recipientTypography.namePx, limit?.namePx),
    linePx: scaled(recipientTypography.linePx, limit?.linePx),
    ...(override || {}),
  };
}

// הכתב של שני הבלוקים בגודל נתון. גם הפריסה וגם התקרה עוברות כאן, כך שהתקרה בודקת
// בדיוק את מה שיודפס. flapDepthMm רק כשהשולח על הלשונית
function getTypographyAt(dimensions, textStyle, scale, { senderOverride = null, flapDepthMm = null } = {}) {
  const recipient = getRecipientTypography(dimensions, textStyle, scale);
  return {
    recipient,
    sender: resolveSenderTypography(recipient, senderOverride, getSenderTypographyLimit(dimensions, flapDepthMm)),
  };
}

// הערכת הגובה של בלוק טקסט לפי מספר השורות בכל גודל. שבירת שורות ארוכות לא נספרת -
// גלישה כזאת מתגלה ב-DOM ומקבלת אזהרה (ר' measureEnvelopeOverflow)
export function estimateTextHeightMm(typography, { nameLines, detailLines }, extraMm = 0) {
  return (LABEL_LINE_HEIGHT * (nameLines * typography.namePx + detailLines * typography.linePx)) / MM_TO_PX + extraMm;
}

export function estimateSenderHeightMm(typography) {
  return estimateTextHeightMm(typography, SENDER_LINES, SENDER_EXTRA_MM);
}

// המרווח מתחת לשורת השם נכלל בגובה הנמען
export function estimateRecipientHeightMm(typography, lines = REFERENCE_RECIPIENT_LINES) {
  return estimateTextHeightMm(typography, lines, NAME_LINE_MARGIN_PX / MM_TO_PX);
}

// הגובה שהשולח מקבל על הלשונית: מהשוליים ועד FOLD_GAP_MM לפני הקיפול
function getFlapSenderSpaceMm(dimensions, flapDepthMm) {
  return Math.max(0, Number(flapDepthMm) - FOLD_GAP_MM - getEnvelopeMargin(dimensions));
}

// האם הכול נכנס בגובה החזית בכתב הזה. בפינה השולח, הרווח והנמען חולקים את החזית ונכנסים
// יחד מעל הרווח מהתחתית. בלי שולח ובלשונית יש בחזית רק את הנמען, בין השוליים - השולח
// על הלשונית מוגבל בנפרד, בכתב שלו (getSenderTypographyLimit)
function fitsAtScale(settings, dimensions, senderMode, recipientLines, scale) {
  const { recipient, sender } = getTypographyAt(dimensions, {}, scale, { senderOverride: settings.senderTypography });
  const margin = getEnvelopeMargin(dimensions);
  const recipientHeight = estimateRecipientHeightMm(recipient, recipientLines);
  if (senderMode === 'frontCorner') {
    const used = margin + estimateSenderHeightMm(sender) + CORNER_GAP_MM + recipientHeight;
    return used <= dimensions.heightMm - getCornerBottomGap(dimensions);
  }
  return recipientHeight <= dimensions.heightMm - 2 * margin;
}

// התקרה של גודל הכתב: הגודל הגדול ביותר (בצעדים של המונה) שבו כל התוכן של החזית נכנס
// בגובה, לפי השורות של הנמענים בהדפסה. לא יורדת מתחת למינימום, ובטווח המידות המותרות
// הנמען (והשולח בפינה) תמיד נכנסים במינימום
export function getEnvelopeFontScaleLimit(settings, recipientLines = REFERENCE_RECIPIENT_LINES) {
  const dimensions = resolveEnvelopeDimensions(settings);
  if (!dimensions) return FONT_SCALE_DEFAULT;
  const senderMode = getSenderMode(settings);
  for (let scale = ENVELOPE_FONT_SCALE_MAX; scale > FONT_SCALE_MIN; scale -= FONT_SCALE_STEP) {
    if (fitsAtScale(settings, dimensions, senderMode, recipientLines, scale)) return scale;
  }
  return FONT_SCALE_MIN;
}

// הבחירה של המשתמשת בלי תלות במידות - לשמירה. התקרה לפי המעטפה מוחלת רק בחישוב
// (getEffectiveEnvelopeFontScale), כך שמידות זמניות בזמן הקלדה לא מקטינות את הבחירה
export function normalizeEnvelopeFontScale(scale) {
  const value = Number(scale);
  if (scale === null || scale === '' || !Number.isFinite(value)) return FONT_SCALE_DEFAULT;
  return Math.min(Math.max(value, FONT_SCALE_MIN), ENVELOPE_FONT_SCALE_MAX);
}

// הכתב שבאמת מודפס: הבחירה, אבל לא מעבר למה שנכנס במעטפה, במצב השולח ובשורות הנמענים
export function getEffectiveEnvelopeFontScale(chosenScale, settings, recipientLines = REFERENCE_RECIPIENT_LINES) {
  return Math.min(normalizeEnvelopeFontScale(chosenScale), getEnvelopeFontScaleLimit(settings, recipientLines));
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

// השטח הבטוח לשולח על הלשונית, בקואורדינטות הדף הפתוח (הלשונית בראש הדף, הקיפול ב-y=depth).
// בלשונית משולשת הרוחב במרחק d מהקיפול הוא W*(1-d/D), ולכן הטקסט צמוד לקיפול
function senderRect({ dimensions, flapDepthMm, flapShape, senderTypography }) {
  const { widthMm } = dimensions;
  const margin = getEnvelopeMargin(dimensions);
  const availableHeight = getFlapSenderSpaceMm(dimensions, flapDepthMm);
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

// auto: נמען באנגלית מקבל את השולח משמאל, וכל נמען אחר מימין. בחירה ידנית חלה על כולם
export function resolveCornerSide(cornerSide, recipientLanguage) {
  if (cornerSide === 'right' || cornerSide === 'left') return cornerSide;
  return recipientLanguage === 'en' ? 'left' : 'right';
}

// השולח בפינה העליונה של החזית, בלי סיבוב, והפינה הנגדית נשארת ריקה לבול. הנמען נשאר
// במרכז כמו בלי שולח, ויורד רק כשהוא היה מגיע לשולח - בדיוק עד CORNER_GAP_MM מתחתיו.
// אז הוא צמוד לראש המלבן (verticalAlign: 'top'), כך ששורות מעבר להערכה ממשיכות למטה.
// ההחלטה לפי השורות של הנמען הזה, כך שנמען קצר נשאר במרכז גם כשלאחרים יש יותר שורות.
// התקרה (getEnvelopeFontScaleLimit) כבר הבטיחה שהשולח והנמען נכנסים יחד בגובה
function layoutFrontCorner({ dimensions, recipientTypography, senderTypography, recipientLines, side }) {
  const { widthMm, heightMm } = dimensions;
  const margin = getEnvelopeMargin(dimensions);
  const innerWidth = widthMm - 2 * margin;
  const senderWidth = Math.max(0, Math.min(
    Math.max(innerWidth * CORNER_WIDTH_RATIO, CORNER_MIN_SENDER_WIDTH_MM),
    innerWidth - CORNER_STAMP_MIN_MM,
  ));
  const senderHeight = estimateSenderHeightMm(senderTypography);
  const senders = {
    role: 'senders',
    rotationDeg: 0,
    rect: { x: side === 'left' ? margin : widthMm - margin - senderWidth, y: margin, width: senderWidth, height: senderHeight },
    items: [{ senderIndex: 0, textAlign: side, rect: { x: 0, y: 0, width: senderWidth, height: senderHeight } }],
  };

  const minTop = margin + senderHeight + CORNER_GAP_MM;
  const centeredTop = (heightMm - estimateRecipientHeightMm(recipientTypography, recipientLines)) / 2;
  const recipient = centeredTop >= minTop
    ? recipientBlock(dimensions, 0)
    : {
      role: 'recipient',
      rotationDeg: 0,
      verticalAlign: 'top',
      rect: { x: margin, y: minTop, width: innerWidth, height: Math.max(0, heightMm - margin - minTop) },
    };

  return {
    passes: [{
      id: 'main',
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
      blocks: [senders, recipient],
      guides: [{ points: rectanglePoints(0, 0, widthMm, heightMm), closed: true, dashed: false }],
    }],
    finishedViews: null,
  };
}

// מצבי השולח. מצב חדש הוא רשומה חדשה כאן עם פונקציית פריסה משלה. maxSenders הוא מספר
// השולחים שהמצב מדפיס - שולחים נוספים נשמרים, אבל לא נפרסים ולא נבדקים
export const SENDER_MODES = {
  none: { usesFlap: false, maxSenders: 0, buildLayout: layoutRecipientOnly },
  openFlap: { usesFlap: true, maxSenders: MAX_SENDERS, buildLayout: layoutOpenFlap },
  frontCorner: { usesFlap: false, maxSenders: 1, buildLayout: layoutFrontCorner },
};

export function isEnvelopeSettingsReady(settings) {
  const dimensions = resolveEnvelopeDimensions(settings);
  const mode = SENDER_MODES[getSenderMode(settings)];
  if (!dimensions || !mode) return false;
  if (mode.maxSenders === 0) return true;
  const senders = settings.senders ?? [];
  const flapReady = !mode.usesFlap || (
    isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm) && FLAP_SHAPES.includes(settings.flapShape)
  );
  return flapReady
    && senders.length >= 1
    && senders.length <= MAX_SENDERS
    && senders.slice(0, mode.maxSenders).every(isSenderComplete);
}

// מחזירה null כשאי אפשר לפרוס (מידות לא תקינות). שולח שעוד לא מולא לא מונע פריסה -
// כך התצוגה מתעדכנת בזמן ההקלדה, והכפתורים נחסמים לפי isEnvelopeSettingsReady.
// recipientLanguage (he/en, מ-detectPrintLanguage) קובע את צד השולח בפינה כשהצד אוטומטי.
// runRecipientLines: השורות של כל הנמענים בהדפסה (המקסימום) - קובעות את הכתב, אחד לכולם.
// recipientLines: השורות של הנמען של המעטפה הזאת - קובעות את המיקום שלו בפינה
export function buildEnvelopeLayout(settings, textStyle, { recipientLanguage, recipientLines, runRecipientLines } = {}) {
  const dimensions = resolveEnvelopeDimensions(settings);
  const senderMode = getSenderMode(settings);
  const mode = SENDER_MODES[senderMode];
  if (!dimensions || !mode) return null;
  if (mode.usesFlap && !isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm)) return null;

  const rowLines = recipientLines ?? runRecipientLines ?? REFERENCE_RECIPIENT_LINES;
  const scale = getEffectiveEnvelopeFontScale(textStyle?.fontScale, settings, runRecipientLines ?? rowLines);
  const senders = settings.senders ?? [];
  const { recipient: recipientTypography, sender: senderTypography } = getTypographyAt(
    dimensions,
    textStyle,
    scale,
    { senderOverride: settings.senderTypography, flapDepthMm: mode.usesFlap ? settings.flapDepthMm : null },
  );
  const layout = mode.buildLayout({
    dimensions,
    flapDepthMm: settings.flapDepthMm,
    flapShape: settings.flapShape,
    senderCount: Math.min(senders.length, mode.maxSenders),
    recipientTypography,
    senderTypography,
    recipientLines: rowLines,
    side: resolveCornerSide(settings.cornerSide, recipientLanguage),
  });
  return {
    ...layout,
    senderMode,
    // כשלא מדפיסים שולח בכלל אין מה להעיר. ההערה היא רק על שולח שהמצב משאיר בחוץ
    omittedSenderCount: mode.maxSenders === 0 ? 0 : senders.slice(mode.maxSenders).filter(hasSenderDetails).length,
    typography: { recipient: recipientTypography, sender: senderTypography },
  };
}
