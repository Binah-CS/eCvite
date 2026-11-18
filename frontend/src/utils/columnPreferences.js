import api from '../services/api';
import { refreshExcelColumns } from '../services/excelColumnsCache';

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

// הערך האפקטיבי של "הצג"/"הדפס" לעמודה: מה שנשמר בהעדפות, ואם אין - ברירת המחדל
// ("הצג" לפי defaultOrder של העמודה, "הדפס" לפי PRINT_DEFAULT_FIELDS)
export function resolveColumnFlag(prefs, fieldDefs, technicalName, key) {
  const saved = prefs?.[technicalName]?.[key];
  if (saved !== undefined) return saved;
  if (key === 'show') {
    const field = fieldDefs.find((def) => def.technicalName === technicalName);
    return Boolean(field?.defaultOrder);
  }
  return PRINT_DEFAULT_FIELDS.has(technicalName);
}

// האם ההעדפות השתנו בפועל - משווה את הערך האפקטיבי של הצג/הדפס לכל עמודה, ולא את
// ה-JSON עצמו: סימון וביטול סימון מחזירים לאותו מצב, גם אם במבנה נשאר ערך מפורש
export function hasColumnPrefsChanged(savedPrefs, currentPrefs, fieldDefs) {
  return fieldDefs.some(({ technicalName }) =>
    ['show', 'print'].some((key) =>
      resolveColumnFlag(savedPrefs, fieldDefs, technicalName, key)
        !== resolveColumnFlag(currentPrefs, fieldDefs, technicalName, key)
    )
  );
}

// שולחת את העדפות העמודות (JSON) לשרת ומעדכנת את sessionStorage - משותפת בין
// גרירת סדר עמודות בטבלה (DashboardPage) לבין עמוד ניהול העמודות (ColumnManagementPage), ששתיהן
// שומרות את אותו מבנה preferences בדיוק. מחזירה true אם השרת שמר, false אם לא.
// keepLocalOnFailure - מה קורה כשהשרת נכשל:
//   true (ברירת המחדל, הגרירה בטבלה): שומרים בכל זאת ב-sessionStorage, כדי שהשינוי
//     לא ילך לאיבוד בטעות (שמירה שקטה, הערך המוחזר לא נבדק)
//   false (עמוד ניהול העמודות): לא כותבים כלום - שמירה שנכשלה לא חלה בשום מקום,
//     והעמוד מציג הודעת שגיאה
export async function saveColumnPreferences(user, columnPreferences, { keepLocalOnFailure = true } = {}) {
  let updatedUser = { ...user, columnPreferences };
  let savedToServer = false;
  try {
    const response = await api.updateColumnPreferences(user.phone, columnPreferences);
    updatedUser = response.data;
    savedToServer = true;
    // Preferences changed: refresh the shared column-definition cache once so
    // subsequent screens and imports use the latest configuration.
    await refreshExcelColumns().catch(() => {});
  } catch {
    // השרת נכשל - ר' keepLocalOnFailure למעלה
  }
  if (savedToServer || keepLocalOnFailure) {
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  }
  return savedToServer;
}
