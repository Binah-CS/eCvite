// עמודות שמודפסות היום במדבקה בפועל (ברירת המחדל של "עמודות להדפסה" לפני ששמרו
// העדפה אישית) - שאר העמודות מתחילות לא מסומנות להדפסה
export const PRINT_DEFAULT_FIELDS = new Set([
  'prefix', 'man', 'woman', 'lastName', 'suffix', 'street', 'houseNo', 'city', 'country',
]);

export function parseColumnPreferences(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}