// "חתימה" של שורה לצורך השוואה מול מה ששמור ב-DB - בלי id (מזהה תצוגה מקומי בלבד,
// DataTable מוסיף אותו לכל שורה) ובלי duplicateSalt (לא נשמר ב-DB בכלל). null,
// undefined ו-'' נחשבים אותו ערך - השרת מחזיר null לשדה ריק, והטבלה כותבת '' אחרי
// עריכה, ושורה שערכו תא בה והחזירו אותו לריק לא באמת השתנתה. גם בלי printEnabled
// (הווי "להדפיס" ליד כל נמען) - הוא נשמר בשרת מיד ובנפרד כשמשנים אותו, לא דרך "שמור",
// ולכן שינוי שלו לא אמור לגרום לשמירה לשלוח את השורה שוב
const IGNORED_FIELDS = new Set(['id', 'duplicateSalt', 'printEnabled']);

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
