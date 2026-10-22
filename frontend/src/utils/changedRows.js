// "חתימה" של שורה לצורך השוואה מול מה ששמור ב-DB - בלי id (מזהה תצוגה מקומי בלבד,
// DataTable מוסיף אותו לכל שורה) ובלי duplicateSalt (לא נשמר ב-DB בכלל). null,
// undefined ו-'' נחשבים אותו ערך - השרת מחזיר null לשדה ריק, והטבלה כותבת '' אחרי
// עריכה, ושורה שערכו תא בה והחזירו אותו לריק לא באמת השתנתה
const IGNORED_FIELDS = new Set(['id', 'duplicateSalt']);

export function rowSignature(row) {
  return JSON.stringify(
    Object.keys(row)
      .filter((key) => !IGNORED_FIELDS.has(key))
      .sort()
      .map((key) => [key, row[key] ?? ''])
      .filter(([, value]) => value !== '')
  );
}

// hashCode -> חתימה, לכל שורה ששמורה ב-DB (יש לה hashCode). נבנית מחדש אחרי כל
// טעינה מהשרת ואחרי כל שמירה מוצלחת
export function buildSavedSnapshot(rows) {
  const snapshot = new Map();
  rows.forEach((row) => {
    if (row.hashCode) snapshot.set(row.hashCode, rowSignature(row));
  });
  return snapshot;
}

// רק השורות שבאמת צריך לשלוח בשמירה: חדשות (בלי hashCode) או כאלה שהתוכן שלהן
// שונה ממה ששמור. שורה עם hashCode שלא מופיעה ב-snapshot (למשל נטענה מגיבוי מקומי
// ולא מהשרת) נשלחת גם היא - עדיף לשלוח בלי צורך מאשר לפספס שינוי
export function selectRowsToSave(rows, snapshot) {
  return rows.filter((row) => {
    if (!row.hashCode) return true;
    const saved = snapshot.get(row.hashCode);
    return saved === undefined || saved !== rowSignature(row);
  });
}

// הסדר המלא של הטבלה לשליחה בשמירה, או null כשאין צורך - כדי ששורה שנוספה באמצע
// לא תעבור לסוף בטעינה הבאה מהשרת. נמען קיים - ה-hashCode שלו; שורה חדשה - "#" ואחריו
// המקום שלה ב-rowsToSave (הרשימה שנשלחת בפועל). נשלח רק כשיש שורות חדשות, או כשסדר
// השורות השמורות שונה מהסדר שבו נטענו/נשמרו בפעם האחרונה (ה-snapshot שומר על הסדר)
export function buildOrderToSave(rows, rowsToSave, snapshot) {
  const hasNewRows = rows.some((row) => !row.hashCode);
  const savedNow = rows.map((row) => row.hashCode).filter(Boolean);
  const stillInTable = new Set(savedNow);
  const savedBefore = [...snapshot.keys()].filter((hashCode) => stillInTable.has(hashCode));
  const sameOrder = savedBefore.length === savedNow.length
    && savedBefore.every((hashCode, i) => hashCode === savedNow[i]);
  if (!hasNewRows && sameOrder) return null;

  const indexInRequest = new Map(rowsToSave.map((row, i) => [row, i]));
  return rows.map((row) => (row.hashCode ? row.hashCode : `#${indexInRequest.get(row)}`));
}
