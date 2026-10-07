// מזהה "זהות" נמען - אותם שדות בדיוק שהשרת משתמש בהם כדי לחשב את ה-hash (בעל+אישה+
// שם משפחה+טלפון+עיר+רחוב+מספר בית) - כדי לזהות, עוד לפני השליחה לשרת, ששתי שורות
// (בייבוא אחד, בין גליונות, או מול הטבלה הקיימת) הן בפועל אותו נמען
export function buildIdentityKey(row) {
  return ['man', 'woman', 'lastName', 'phone', 'city', 'street', 'houseNo']
    .map((field) => String(row?.[field] ?? '').trim())
    .join('|');
}

// מאחדת ערכי "שייך ל" מכמה מקורות לרשימה אחת בלי כפילויות, מופרדת בפסיקים - תומכת
// גם בערך שכבר מכיל כמה ערכים מופרדים בפסיק (שדה חופשי שכבר היה בקובץ עצמו)
export function mergeBelongsToValues(...values) {
  const set = new Set();
  values.forEach((value) => {
    String(value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => set.add(s));
  });
  return Array.from(set).join(', ');
}