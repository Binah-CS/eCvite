// סינון לפי עמודות (חלון "סינון", ר' FilterBuilder.jsx, או תיבות הסימון בכותרת העמודה,
// ר' ColumnValueFilter.jsx - שניהם עורכים את אותם תנאים): לכל עמודה - "כולל" או "לא
// כולל" רשימת ערכים. כמה ערכים באותו תנאי = "או", "לא כולל" = "חוץ מ", כמה תנאים
// יחד = "וגם". רץ על השורות לפני שהן מגיעות ל-DataGrid - ולכן לא חלה עליו המגבלה של
// הגרסה החינמית (תנאי סינון אחד בלבד)

// הערך של תא ריק ברשימה (מוצג כ"(ריק)")
export const EMPTY_VALUE = '';

// שדות שיכולים להכיל כמה ערכים מופרדים בפסיק - כל ערך מופיע ברשימה בנפרד, כך
// ש"משפחה" תופס גם נמען ששייך ל"משפחה, חברים"
const MULTI_VALUE_FIELDS = new Set(['belongsTo']);

// כל הערכים של תא, כמו שהם מופיעים ברשימה. תמיד לפחות ערך אחד (ריק = EMPTY_VALUE)
export function cellValues(row, field) {
  const raw = row[field];
  if (typeof raw === 'boolean' || field === 'print') return [raw ? 'כן' : 'לא'];
  const text = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!MULTI_VALUE_FIELDS.has(field)) return [text];
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length ? Array.from(new Set(parts)) : [EMPTY_VALUE];
}

// כל הערכים השונים בעמודה, עם מספר השורות של כל אחד - ממוינים לפי א"ב, והריק בסוף
export function collectColumnValues(rows, field) {
  const counts = new Map();
  rows.forEach((row) => {
    cellValues(row, field).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => {
    if (a.value === EMPTY_VALUE) return 1;
    if (b.value === EMPTY_VALUE) return -1;
    return a.value.localeCompare(b.value, 'he', { numeric: true });
  });
}

// מהסימונים ברשימת תיבות הסימון (בכותרת העמודה) לסינון של העמודה. mode - לפי מה
// שהמשתמשת עשתה: הורידה סימונים מ"הכל" = "לא כולל" את הלא-מסומנים, ניקתה הכל וסימנה
// = "כולל" את המסומנים. כך שורה חדשה עם ערך שלא היה ברשימה מתנהגת כמו שמצפים: אחרי
// "רק בני ברק" עיר חדשה לא מופיעה, ואחרי "כולם חוץ מבני ברק" היא כן. null = הכל
// מסומן, אין סינון
export function buildColumnFilter(allValues, checkedValues, mode) {
  const checked = allValues.filter((value) => checkedValues.has(value));
  const unchecked = allValues.filter((value) => !checkedValues.has(value));
  if (unchecked.length === 0) return null;
  return mode === 'include'
    ? { mode: 'include', values: checked }
    : { mode: 'exclude', values: unchecked };
}

// filter - { mode: 'include' (רק אלה) | 'exclude' (כולם חוץ מאלה), values } של עמודה אחת
export function isValueChecked(filter, value) {
  if (!filter) return true;
  const listed = filter.values.includes(value);
  return filter.mode === 'include' ? listed : !listed;
}

// שורה עוברת אם בכל עמודה מסוננת לפחות אחד מהערכים שלה מסומן
export function rowMatchesColumnFilters(row, filters) {
  return Object.entries(filters).every(([field, filter]) =>
    !filter || cellValues(row, field).some((value) => isValueChecked(filter, value)));
}

export function applyColumnFilters(rows, filters) {
  if (!filters || Object.keys(filters).length === 0) return rows;
  return rows.filter((row) => rowMatchesColumnFilters(row, filters));
}

// כל הסינונים חוץ מזה של העמודה הזו - רשימת הערכים של עמודה נבנית מהשורות שעוברות
// את שאר הסינונים (כמו באקסל), כדי שלא יופיעו בה ערכים שבכל מקרה לא יוצגו
export function withoutColumnFilter(filters, field) {
  const { [field]: omitted, ...rest } = filters;
  return rest;
}

// התנאים מחלון "סינון" (עמודה, כולל/לא כולל, ערכים) -> הסינון לכל עמודה. תנאי בלי
// עמודה או בלי ערכים עוד לא נבנה עד הסוף - לא מסנן כלום
export function conditionsToFilters(conditions) {
  const filters = {};
  conditions.forEach(({ field, mode, values }) => {
    if (field && values.length > 0) filters[field] = { mode, values };
  });
  return filters;
}
