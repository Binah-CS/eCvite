// src/components/EnvelopeSheet.jsx
// ציור של משטח מעטפה אחד (דף פתוח, חזית או גב) לפי הפריסה מ-envelopeLayout. אותו רכיב
// משמש גם לתצוגה וגם להדפסה, כדי שמה שרואים הוא מה שמודפס.
//
// כל הקואורדינטות כאן ב-style רגיל ולא ב-sx בכוונה: מטמון ה-RTL של MUI (rtl.js) הופך
// left/right ו-translate ב-sx, אבל לא נוגע ב-style של האלמנט. הסיבוב ב-180° הוא על
// המיכל של השולחים ולא על כל שורה, ולכן סדר התווים והכיווניות נשמרים.
import { LABEL_LINE_HEIGHT } from '../utils/labelSheetLayout';
import { parseColumnPreferences, PRINT_DEFAULT_FIELDS } from '../utils/columnPreferences';
import {
  EXTRA_PRINT_FIELDS,
  buildAddressLine1,
  buildAddressLine2,
  buildCountryLine,
  buildNameLine,
  detectPrintLanguage,
  hasHebrewEnglishSalutation,
  splitHebrewGreeting,
} from '../pages/PrintPreviewPage';
import { REFERENCE_RECIPIENT_LINES } from '../utils/envelopeLayout';

// השורות של נמען, לפי הסדר שבו הן מודפסות. kind קובע את הגודל: salutation, greeting ו-name
// בגודל שם, detail בגודל פרטים. המקום היחיד שמחליט אילו שורות יש - גם הרינדור וגם ספירת
// השורות לתקרת הכתב (countRecipientLines) עוברים כאן
export function getRecipientLines(row, getPrintFlag, textOptions) {
  const { englishSalutation, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine } = textOptions;
  const printLanguage = detectPrintLanguage(row, getPrintFlag);
  const fullNameLine = buildNameLine(row, getPrintFlag, printLanguage, englishSalutation);
  const { greetingLine, nameLine } = splitHebrewGreeting(fullNameLine, printLanguage, greetingShow, greetingSeparateLine);
  const addressLine = buildAddressLine1(row, getPrintFlag, printLanguage);
  const cityLine = buildAddressLine2(row, getPrintFlag);
  const countryLine = buildCountryLine(row, getPrintFlag);
  const keepEmptyAddressLine = !addressLine && emptyLineWhenNoAddress
    && (getPrintFlag('street') || getPrintFlag('houseNo')) && cityLine;

  const lines = [];
  if (printLanguage === 'en' && hasHebrewEnglishSalutation(englishSalutation) && fullNameLine) {
    lines.push({ key: 'salutation', kind: 'salutation', text: englishSalutation });
  }
  if (greetingLine) lines.push({ key: 'greeting', kind: 'greeting', text: greetingLine });
  if (nameLine) lines.push({ key: 'name', kind: 'name', text: nameLine });
  // שורה ריקה עם רווח קשיח (NBSP) ולא רווח רגיל, כדי שתשמור את הגובה שלה
  if (addressLine || keepEmptyAddressLine) lines.push({ key: 'address', kind: 'detail', text: addressLine || ' ' });
  if (cityLine) lines.push({ key: 'city', kind: 'detail', text: cityLine });
  if (countryLine) lines.push({ key: 'country', kind: 'detail', text: countryLine });
  EXTRA_PRINT_FIELDS.forEach(({ field, labels }) => {
    if (getPrintFlag(field) && row[field]) {
      lines.push({ key: field, kind: 'detail', text: `${labels[printLanguage] ?? labels.he}: ${row[field]}` });
    }
  });
  return { printLanguage, lines };
}

// כמה שורות בכל גודל יש לנמענים: המקסימום על פני כולם, כך שכתב אחד לכל ההדפסה נכנס
// אצל כל אחד. בלי נמענים - ההנחה של envelopeLayout
export function countRecipientLines(rows, getPrintFlag, textOptions) {
  if (!rows?.length) return REFERENCE_RECIPIENT_LINES;
  return rows.reduce((max, row) => {
    const { lines } = getRecipientLines(row, getPrintFlag, textOptions);
    const detailLines = lines.filter((line) => line.kind === 'detail').length;
    return {
      nameLines: Math.max(max.nameLines, lines.length - detailLines),
      detailLines: Math.max(max.detailLines, detailLines),
    };
  }, { nameLines: 0, detailLines: 0 });
}

// "עמודות להדפסה" מ"ניהול עמודות" - אותו היגיון כמו בדף המדבקות
export function createPrintFlagGetter() {
  let preferences = {};
  try {
    preferences = parseColumnPreferences(JSON.parse(sessionStorage.getItem('user') || 'null')?.columnPreferences);
  } catch {
    preferences = {};
  }
  return (technicalName) => {
    const saved = preferences[technicalName]?.print;
    return saved !== undefined ? saved : PRINT_DEFAULT_FIELDS.has(technicalName);
  };
}

const mm = (value) => `${value}mm`;

function boxStyle(rect) {
  return { position: 'absolute', left: mm(rect.x), top: mm(rect.y), width: mm(rect.width), height: mm(rect.height) };
}

function textLineStyle(fontSizePx, fontWeight, color, textAlign = 'center') {
  return {
    fontSize: `${fontSizePx}px`,
    fontWeight,
    color,
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign,
    unicodeBidi: 'plaintext',
  };
}

// התיבה והתוכן מסומנים ב-data-envelope-recipient-box/-content, כמו אצל השולח, כדי
// שגלישה (בדרך כלל שורה ארוכה שנשברה) תימדד ב-DOM ותקבל אזהרה
function RecipientText({ row, typography, textOptions, getPrintFlag, verticalAlign = 'center' }) {
  const { printLanguage, lines } = getRecipientLines(row, getPrintFlag, textOptions);
  const { greetingAlign } = textOptions;

  const nameStyle = { ...textLineStyle(typography.namePx, typography.fontWeight, '#000000'), marginBottom: 2 };
  const detailStyle = textLineStyle(typography.linePx, typography.fontWeight, '#333333');
  const lineStyles = {
    salutation: { ...nameStyle, marginBottom: 0 },
    greeting: {
      ...nameStyle,
      marginBottom: 0,
      alignSelf: 'stretch',
      textAlign: { right: 'start', left: 'end' }[greetingAlign] ?? 'center',
      ...(greetingAlign === 'right' ? { marginInlineStart: '1mm' } : {}),
      ...(greetingAlign === 'left' ? { marginInlineEnd: '1mm' } : {}),
    },
    name: nameStyle,
    detail: detailStyle,
  };

  return (
    <div
      data-envelope-recipient-box=""
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: verticalAlign === 'top' ? 'flex-start' : 'center',
        overflow: 'hidden',
        fontFamily: typography.fontFamily,
        direction: printLanguage === 'en' ? 'ltr' : 'rtl',
      }}
    >
      <div
        data-envelope-recipient-content=""
        style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        {lines.map(({ key, kind, text }) => <div key={key} style={lineStyles[kind]}>{text}</div>)}
      </div>
    </div>
  );
}

const printEverything = () => true;

// textAlign הוא צד פיזי (right/left) או center. בפינה הטקסט צמוד לקצה המעטפה, וכיוון
// הכתיבה עדיין נקבע לפי שפת השולח עצמו
function SenderText({ sender, typography, textAlign }) {
  // שם השולח ממופה ל-display כדי להשתמש באותו זיהוי שפה ובאותה בניית כתובת כמו בנמען
  const printLanguage = detectPrintLanguage({ ...sender, display: sender.name }, printEverything);
  const addressLine = buildAddressLine1(sender, printEverything, printLanguage);
  const cityLine = [sender.city, sender.zip].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const countryLine = String(sender.country ?? '').trim();
  const nameStyle = textLineStyle(typography.namePx, typography.fontWeight, '#000000', textAlign);
  const detailStyle = textLineStyle(typography.linePx, typography.fontWeight, '#333333', textAlign);

  return (
    <div
      data-envelope-sender-content=""
      style={{ width: '100%', fontFamily: typography.fontFamily, direction: printLanguage === 'en' ? 'ltr' : 'rtl' }}
    >
      {sender.name && <div style={nameStyle}>{sender.name}</div>}
      {addressLine && <div style={detailStyle}>{addressLine}</div>}
      {cityLine && <div style={detailStyle}>{cityLine}</div>}
      {countryLine && <div style={detailStyle}>{countryLine}</div>}
    </div>
  );
}

function SendersBlock({ block, senders, typography }) {
  return (
    <div
      style={{
        ...boxStyle(block.rect),
        transform: block.rotationDeg ? `rotate(${block.rotationDeg}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      {block.items.map(({ senderIndex, rect, textAlign = 'center' }) => (senders[senderIndex] ? (
        <div
          key={senderIndex}
          data-envelope-sender-box=""
          style={{ ...boxStyle(rect), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <SenderText sender={senders[senderIndex]} typography={typography} textAlign={textAlign} />
        </div>
      ) : null))}
    </div>
  );
}

// קווי המעטפה והקיפול, רק לעין. בדף ההדפסה הם מוסתרים דרך המחלקה envelope-guides
function Guides({ surface }) {
  return (
    <svg
      className="envelope-guides"
      aria-hidden="true"
      viewBox={`0 0 ${surface.pageWidthMm} ${surface.pageHeightMm}`}
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
    >
      {surface.guides.map((guide, index) => {
        const Shape = guide.closed ? 'polygon' : 'polyline';
        return (
          <Shape
            key={index}
            points={guide.points.map((point) => point.join(',')).join(' ')}
            fill="none"
            stroke="#8a94a6"
            strokeWidth={0.4}
            strokeDasharray={guide.dashed ? '2.5 1.5' : undefined}
          />
        );
      })}
    </svg>
  );
}

export default function EnvelopeSheet({ surface, row, senders, typography, textOptions, getPrintFlag, showGuides = true, className, breakAfter = false }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: mm(surface.pageWidthMm),
        height: mm(surface.pageHeightMm),
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        breakAfter: breakAfter ? 'page' : 'auto',
      }}
    >
      {showGuides && <Guides surface={surface} />}
      {surface.blocks.map((block) => (block.role === 'senders' ? (
        <SendersBlock key={block.role} block={block} senders={senders} typography={typography.sender} />
      ) : (
        <div key={block.role} style={boxStyle(block.rect)}>
          <RecipientText
            row={row}
            typography={typography.recipient}
            textOptions={textOptions}
            getPrintFlag={getPrintFlag}
            verticalAlign={block.verticalAlign}
          />
        </div>
      )))}
    </div>
  );
}
