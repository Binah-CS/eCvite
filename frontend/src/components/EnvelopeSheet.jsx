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
  buildAddressLine1,
  buildAddressLine2,
  buildCountryLine,
  buildNameLine,
  detectPrintLanguage,
  hasHebrewEnglishSalutation,
  splitHebrewGreeting,
} from '../pages/PrintPreviewPage';

// אותה רשימה כמו EXTRA_PRINT_FIELDS ב-PrintPreviewPage (קבוע פרטי של קוד המדבקות)
const EXTRA_PRINT_FIELDS = [
  { field: 'phone', labels: { he: 'טלפון', en: 'Phone' } },
  { field: 'mail', labels: { he: 'מייל', en: 'Email' } },
  { field: 'fatherName', labels: { he: 'שם האב', en: "Father's name" } },
  { field: 'motherName', labels: { he: 'שם האם', en: "Mother's name" } },
  { field: 'belongsTo', labels: { he: 'שייך ל', en: 'Belongs to' } },
  { field: 'addressNote', labels: { he: 'הערת כתובת', en: 'Address note' } },
  { field: 'neighborhood', labels: { he: 'שכונה', en: 'Neighborhood' } },
];

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

function textLineStyle(fontSizePx, fontWeight, color) {
  return {
    fontSize: `${fontSizePx}px`,
    fontWeight,
    color,
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign: 'center',
    unicodeBidi: 'plaintext',
  };
}

function RecipientText({ row, typography, textOptions, getPrintFlag }) {
  const { englishSalutation, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine, greetingAlign } = textOptions;
  const printLanguage = detectPrintLanguage(row, getPrintFlag);
  const fullNameLine = buildNameLine(row, getPrintFlag, printLanguage, englishSalutation);
  const { greetingLine, nameLine } = splitHebrewGreeting(fullNameLine, printLanguage, greetingShow, greetingSeparateLine);
  const addressLine = buildAddressLine1(row, getPrintFlag, printLanguage);
  const cityLine = buildAddressLine2(row, getPrintFlag);
  const countryLine = buildCountryLine(row, getPrintFlag);
  const keepEmptyAddressLine = !addressLine && emptyLineWhenNoAddress
    && (getPrintFlag('street') || getPrintFlag('houseNo')) && cityLine;

  const nameStyle = { ...textLineStyle(typography.namePx, typography.fontWeight, '#000000'), marginBottom: 2 };
  const detailStyle = textLineStyle(typography.linePx, typography.fontWeight, '#333333');
  const greetingStyle = {
    ...nameStyle,
    marginBottom: 0,
    alignSelf: 'stretch',
    textAlign: { right: 'start', left: 'end' }[greetingAlign] ?? 'center',
    ...(greetingAlign === 'right' ? { marginInlineStart: '1mm' } : {}),
    ...(greetingAlign === 'left' ? { marginInlineEnd: '1mm' } : {}),
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: typography.fontFamily,
        direction: printLanguage === 'en' ? 'ltr' : 'rtl',
      }}
    >
      {printLanguage === 'en' && hasHebrewEnglishSalutation(englishSalutation) && fullNameLine && (
        <div style={{ ...nameStyle, marginBottom: 0 }}>{englishSalutation}</div>
      )}
      {greetingLine && <div style={greetingStyle}>{greetingLine}</div>}
      {nameLine && <div style={nameStyle}>{nameLine}</div>}
      {(addressLine || keepEmptyAddressLine) && <div style={detailStyle}>{addressLine || ' '}</div>}
      {cityLine && <div style={detailStyle}>{cityLine}</div>}
      {countryLine && <div style={detailStyle}>{countryLine}</div>}
      {EXTRA_PRINT_FIELDS.map(({ field, labels }) => (getPrintFlag(field) && row[field] ? (
        <div key={field} style={detailStyle}>{labels[printLanguage] ?? labels.he}: {row[field]}</div>
      ) : null))}
    </div>
  );
}

const printEverything = () => true;

function SenderText({ sender, typography }) {
  // שם השולח ממופה ל-display כדי להשתמש באותו זיהוי שפה ובאותה בניית כתובת כמו בנמען
  const printLanguage = detectPrintLanguage({ ...sender, display: sender.name }, printEverything);
  const addressLine = buildAddressLine1(sender, printEverything, printLanguage);
  const cityLine = [sender.city, sender.zip].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const countryLine = String(sender.country ?? '').trim();
  const nameStyle = textLineStyle(typography.namePx, typography.fontWeight, '#000000');
  const detailStyle = textLineStyle(typography.linePx, typography.fontWeight, '#333333');

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
      {block.items.map(({ senderIndex, rect }) => (senders[senderIndex] ? (
        <div
          key={senderIndex}
          data-envelope-sender-box=""
          style={{ ...boxStyle(rect), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <SenderText sender={senders[senderIndex]} typography={typography} />
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
          <RecipientText row={row} typography={typography.recipient} textOptions={textOptions} getPrintFlag={getPrintFlag} />
        </div>
      )))}
    </div>
  );
}
