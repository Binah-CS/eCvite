// src/fonts/fonts.js
// מקור האמת היחיד לכתבים להדפסה: רכיב הבחירה, התצוגות וההדפסה קוראים רק מכאן.
// כתב חדש = שורה אחת ב-FONTS (ואם הוא לא כתב מערכת - import ב-fonts.css). כל ההתנהגות
// (קבוצה בתפריט, דוגמה, תגית "עברית/אנגלית בלבד", סינון לשדה האנגלית, אזהרות) נגזרת
// מהשדות של השורה, בלי תנאים על כתב מסוים.
//
// family   - שם המשפחה בלבד, כמו שהוא ב-CSS
// fallback - משפחה כללית למקרה שהכתב לא זמין
// scripts  - באילו שפות יש בכתב אותיות: 'he' / 'en'
// hidden   - לא מוצע בתפריט, ונשאר רק כדי שמי שכבר שמר אותו ימשיך להדפיס בו
// legacyValues - הערכים שנשמרו לפני שנשמר id (מחרוזת ה-CSS של הרשימה הישנה)

export const FONT_CATEGORIES = [
  { id: 'regular', label: 'רגיל' },
  { id: 'festive', label: 'חגיגי' },
  { id: 'handwriting', label: 'כתב יד' },
];

const FONT_ROWS = [
  { id: 'arial', displayName: 'Arial', family: 'Arial', fallback: 'sans-serif', category: 'regular', scripts: ['he', 'en'], legacyValues: ['Arial, sans-serif'] },
  { id: 'tahoma', displayName: 'Tahoma', family: 'Tahoma', fallback: 'sans-serif', category: 'regular', scripts: ['he', 'en'], legacyValues: ['Tahoma, sans-serif'] },
  { id: 'heebo', displayName: 'Heebo', family: '"Heebo"', fallback: 'sans-serif', category: 'regular', scripts: ['he', 'en'] },
  { id: 'rubik', displayName: 'Rubik', family: '"Rubik"', fallback: 'sans-serif', category: 'regular', scripts: ['he', 'en'] },
  { id: 'courier-new', displayName: 'Courier New', family: '"Courier New"', fallback: 'monospace', category: 'regular', scripts: ['he', 'en'], hidden: true, legacyValues: ['"Courier New", monospace'] },

  { id: 'david-libre', displayName: 'David Libre', family: '"David Libre"', fallback: 'serif', category: 'festive', scripts: ['he', 'en'] },
  { id: 'frank-ruhl-libre', displayName: 'Frank Ruhl Libre', family: '"Frank Ruhl Libre"', fallback: 'serif', category: 'festive', scripts: ['he', 'en'] },
  { id: 'suez-one', displayName: 'Suez One', family: '"Suez One"', fallback: 'serif', category: 'festive', scripts: ['he', 'en'] },
  { id: 'secular-one', displayName: 'Secular One', family: '"Secular One"', fallback: 'sans-serif', category: 'festive', scripts: ['he', 'en'] },
  { id: 'david', displayName: 'David', family: 'David', fallback: 'serif', category: 'festive', scripts: ['he', 'en'], hidden: true, legacyValues: ['David, serif'] },

  { id: 'playpen-sans-hebrew', displayName: 'Playpen Sans Hebrew', family: '"Playpen Sans Hebrew"', fallback: 'sans-serif', category: 'handwriting', scripts: ['he', 'en'] },
  { id: 'parisienne', displayName: 'Parisienne', family: '"Parisienne"', fallback: 'serif', category: 'handwriting', scripts: ['en'] },
  { id: 'dancing-script', displayName: 'Dancing Script', family: '"Dancing Script"', fallback: 'serif', category: 'handwriting', scripts: ['en'] },
  { id: 'playfair-display', displayName: 'Playfair Display', family: '"Playfair Display"', fallback: 'serif', category: 'handwriting', scripts: ['en'] },
  { id: 'gveret-levin', displayName: 'גברת לוין', family: '"Gveret Levin"', fallback: 'sans-serif', category: 'handwriting', scripts: ['he'] },
  { id: 'noto-rashi-hebrew', displayName: 'רש"י', family: '"Noto Rashi Hebrew"', fallback: 'serif', category: 'handwriting', scripts: ['he'] },
];

export const FONTS = FONT_ROWS.map((font) => ({ ...font, cssFamily: `${font.family}, ${font.fallback}` }));

export const DEFAULT_FONT_ID = 'arial';

const FONTS_BY_ID = new Map(FONTS.map((font) => [font.id, font]));

export function getFont(id) {
  return FONTS_BY_ID.get(id) ?? null;
}

export function supportsScript(font, script) {
  return Boolean(font?.scripts.includes(script));
}

// id, או ערך ישן (מחרוזת ה-CSS שנשמרה פעם), הופכים ל-id. כל ערך אחר - fallback
export function normalizeFontId(value, fallback = DEFAULT_FONT_ID) {
  if (typeof value !== 'string' || value === '') return fallback;
  if (FONTS_BY_ID.has(value)) return value;
  const legacy = FONTS.find((font) => font.legacyValues?.includes(value));
  return legacy ? legacy.id : fallback;
}

// הכתב לאנגלית הוא אופציונלי: '' (או ערך לא מוכר, או כתב בלי אנגלית) = "כמו הכתב הראשי"
export function normalizeEnglishFontId(value) {
  const id = normalizeFontId(value, '');
  return supportsScript(getFont(id), 'en') ? id : '';
}

// שני השדות לפי שפה: fontType הוא הכתב לעברית (חייב לתמוך בעברית), englishFontType הכתב
// לאנגלית ('' = כמו העברית). תאימות: כתב בלי עברית שנשמר פעם כראשי עובר לשדה האנגלית (אם
// הוא ריק), והשדה הראשי חוזר לברירת המחדל
export function normalizeFontPair(primaryValue, englishValue) {
  let fontType = normalizeFontId(primaryValue);
  let englishFontType = normalizeEnglishFontId(englishValue);
  if (!supportsScript(getFont(fontType), 'he')) {
    if (englishFontType === '') englishFontType = normalizeEnglishFontId(fontType);
    fontType = DEFAULT_FONT_ID;
  }
  return { fontType, englishFontType };
}

// ה-font-family של כתובת אחת לפי השפה שלה (detectPrintLanguage). הכתב של השפה השנייה הוא
// fallback: הוא מדפיס רק אותיות שאין בכתב הראשון (למשל מילה באנגלית בכתובת עברית בכתב
// עברי בלבד). ספרות וסימני פיסוק נשארים בכתב של שפת הכתובת
export function getAddressFontFamily(language, primaryId, englishId = '') {
  const primary = getFont(normalizeFontId(primaryId));
  const english = getFont(normalizeEnglishFontId(englishId));
  if (!english || english.id === primary.id) return primary.cssFamily;
  return language === 'en'
    ? `${english.family}, ${primary.family}, ${english.fallback}`
    : `${primary.family}, ${english.family}, ${primary.fallback}`;
}

const SCRIPT_WARNINGS = {
  he: 'יש כתובות בעברית, ואף אחד מהכתבים שנבחרו לא תומך בעברית - הן יודפסו בכתב ברירת מחדל.',
  en: 'יש כתובות באנגלית, ואף אחד מהכתבים שנבחרו לא תומך באנגלית - הן יודפסו בכתב ברירת מחדל. אפשר לבחור "כתב לאנגלית".',
};

// אזהרה לכל שפה שיש בה כתובות להדפסה (languages, לפי detectPrintLanguage) ואף אחד
// מהכתבים שנבחרו לא תומך בה, או null. בלי languages - בודקים את שתי השפות
export function getFontScriptWarning(primaryId, englishId = '', languages = Object.keys(SCRIPT_WARNINGS)) {
  const { fontType, englishFontType } = normalizeFontPair(primaryId, englishId);
  const chosen = [getFont(fontType), getFont(englishFontType)].filter(Boolean);
  const missing = Object.keys(SCRIPT_WARNINGS).filter((script) => languages.includes(script)
    && !chosen.some((font) => supportsScript(font, script)));
  return missing.length ? missing.map((script) => SCRIPT_WARNINGS[script]).join(' ') : null;
}

// טקסט לדוגמה שכולל עברית, לטינית וספרות - כדי ש-document.fonts.load יוריד את כל ה-subsets
const FONT_LOAD_SAMPLE = 'אבג Abc 123';
const FONT_LOAD_TIMEOUT_MS = 3000;

// פותח את חלון ההדפסה רק אחרי שהכתבים של ההדפסה ירדו - אחרת הדפסה ישירה (autoPrint)
// יוצאת בכתב ברירת מחדל. אם הטעינה נתקעת, מדפיסים בכל זאת אחרי FONT_LOAD_TIMEOUT_MS
export function printWhenFontsReady({ fontType, englishFontType = '', fontWeight = 'regular' } = {}) {
  const fontSet = typeof document !== 'undefined' ? document.fonts : null;
  if (!fontSet) {
    window.print();
    return Promise.resolve();
  }
  const weight = fontWeight === 'bold' ? 'bold' : 'normal';
  const families = [...new Set(['he', 'en'].map((language) => getAddressFontFamily(language, fontType, englishFontType)))];
  const loaded = Promise.all(families.map((family) => fontSet.load(`${weight} 16px ${family}`, FONT_LOAD_SAMPLE).catch(() => null)))
    .then(() => fontSet.ready);
  const timeout = new Promise((resolve) => { setTimeout(resolve, FONT_LOAD_TIMEOUT_MS); });
  return Promise.race([loaded, timeout]).then(() => window.print());
}
