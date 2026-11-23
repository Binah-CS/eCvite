// סדר העמודות של המשתמשת - אותו סדר שהטבלה מציגה (ר' DataTable, columnOrder): הסדר
// שנשמר אצלה (columnPreferences.__order) אם יש, אחרת ברירת המחדל (defaultOrder מ-excel_columns).
// עמודה שכבר לא קיימת יוצאת מהרשימה, ועמודה חדשה שעוד לא בסדר השמור נוספת בסוף (#79)
export function resolveColumnOrder(savedOrder, fieldDefs) {
  const defaultNames = fieldDefs
    .slice()
    .sort((a, b) => (a.defaultOrder ?? 999) - (b.defaultOrder ?? 999))
    .map((f) => f.technicalName);
  const base = Array.isArray(savedOrder) ? savedOrder : defaultNames;
  const stillValid = base.filter((name) => defaultNames.includes(name));
  const missing = defaultNames.filter((name) => !stillValid.includes(name));
  return [...stillValid, ...missing];
}

// מזיזה עמודה למקום של עמודה אחרת ברשימה (גרירה בהגדרות): גרירה למטה - אחרי עמודת
// היעד, גרירה למעלה - לפניה. עמודות שלא מוצגות ברשימה (למשל print) נשארות במקומן
export function moveColumn(order, sourceName, targetName) {
  const from = order.indexOf(sourceName);
  const to = order.indexOf(targetName);
  if (from === -1 || to === -1 || from === to) return order;
  const next = order.filter((name) => name !== sourceName);
  next.splice(to, 0, sourceName);
  return next;
}
