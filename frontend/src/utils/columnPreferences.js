import api from '../services/api';

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

// שולחת את העדפות העמודות (JSON) לשרת ומעדכנת את sessionStorage - משותפת בין
// גרירת סדר עמודות בטבלה (DashboardPage) לבין מסך ההגדרות (SettingsPage), ששתיהן
// שומרות את אותו מבנה preferences בדיוק
export async function saveColumnPreferences(user, columnPreferences) {
  let updatedUser = { ...user, columnPreferences };
  try {
    const response = await api.updateColumnPreferences(user.phone, columnPreferences);
    updatedUser = response.data;
  } catch {
    // אם קריאת השרת נכשלה, שומרים לפחות מקומית כדי שהשינוי לא ילך לאיבוד בטעות
  }
  sessionStorage.setItem('user', JSON.stringify(updatedUser));
}