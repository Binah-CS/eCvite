import { GMAIL_REGEX, HOUSE_NO_PATTERN } from './validation';

// אפשרויות "עבור איזה שמחה?" - משותפות להרשמה ולעמוד פרטי החשבון
export const EVENT_TYPES = ['חתונה', 'בר מצווה', 'אחר'];

// תוויות וסדר הצגה בלבד. מה מוצג, מה נעול ומה חובה מגיע מהשרת (ר' AccountFields
// ב-backend) - שדה שהשרת לא החזיר לא מוצג, גם אם הוא מופיע כאן
export const ACCOUNT_FIELDS = [
  { name: 'firstNameWoman', label: 'שם פרטי' },
  { name: 'lastName', label: 'שם משפחה' },
  { name: 'phone', label: 'פלאפון' },
  { name: 'email', label: 'מייל' },
  { name: 'eventType', label: 'עבור איזה שמחה?', options: EVENT_TYPES },
  { name: 'city', label: 'עיר' },
  { name: 'street', label: 'רחוב' },
  { name: 'houseNumber', label: 'מספר בית' },
];

// זהה ל-AccountValidation.MAX_LENGTH בשרת
export const MAX_LENGTH = 255;

// זהות להודעות ב-AccountValidation בשרת. משמשות גם לפרטי השולח (senderDetails.js)
export const ACCOUNT_ERRORS = {
  required: 'שדה חובה',
  tooLong: 'הערך ארוך מדי',
  email: 'המייל שהוזן אינו תקין',
  houseNumber: 'מספר בית לא תקין',
  zip: 'מיקוד לא תקין',
};

export const normalize = (value) => String(value ?? '').trim();

// השם הפרטי של המשתמשת - בברכה ובאווטאר בתפריט (DashboardPage), וכ-fallback לשם
// השולח. קודם firstNameWoman (השדה שבטופס ההרשמה ובעמוד פרטי החשבון), ואז
// firstNameMan - משתמשות ותיקות שהשם שלהן נשמר רק שם. ערך ריק (משתמשת חדשה נשמרת
// עם firstNameMan = "") מדולג. זהה לסדר של "מי שינה" בהיסטוריה
// (RecipientController.getRecipientHistory)
export function getDisplayFirstName(user, fallback = 'משתמש') {
  return [user?.firstNameWoman, user?.firstNameMan]
    .map((name) => String(name ?? '').trim())
    .find(Boolean) || fallback;
}

// השדות להצגה לפי הרשימות מהשרת, בסדר של ACCOUNT_FIELDS. שדה חדש שהשרת מחזיר ועוד
// אין לו תווית כאן מוצג בסוף עם השם הטכני שלו, כדי שלא ייעלם בשקט
export function getVisibleAccountFields(editableFields = [], readOnlyFields = []) {
  const serverFields = [...readOnlyFields, ...editableFields];
  const known = ACCOUNT_FIELDS.filter((field) => serverFields.includes(field.name));
  const unknown = serverFields
    .filter((name) => !ACCOUNT_FIELDS.some((field) => field.name === name))
    .map((name) => ({ name, label: name }));
  return [...known, ...unknown];
}

export function toFormValues(user, fieldNames) {
  return Object.fromEntries(fieldNames.map((name) => [name, String(user?.[name] ?? '')]));
}

// רק שדות שניתנים לעריכה ושהערך שלהם (אחרי trim) שונה מהשמור - זה מה שנשלח לשרת,
// וגם מה שקובע אם כפתור השמירה פעיל
export function getChangedFields(savedValues, currentValues, editableFields = []) {
  return Object.fromEntries(
    editableFields
      .filter((name) => normalize(currentValues?.[name]) !== normalize(savedValues?.[name]))
      .map((name) => [name, normalize(currentValues?.[name])])
  );
}

// אותם כללים כמו AccountValidation בשרת. נבדקים רק השדות שהשתנו - ערך ישן ששמור
// בפורמט אחר לא חוסם שמירה של שדות אחרים
export function validateAccount(changes, requiredFields = []) {
  const errors = {};
  Object.entries(changes).forEach(([name, raw]) => {
    const value = normalize(raw);
    if (!value) {
      if (requiredFields.includes(name)) errors[name] = ACCOUNT_ERRORS.required;
      return;
    }
    if (value.length > MAX_LENGTH) errors[name] = ACCOUNT_ERRORS.tooLong;
    else if (name === 'email' && !GMAIL_REGEX.test(value)) errors[name] = ACCOUNT_ERRORS.email;
    else if (name === 'houseNumber' && !HOUSE_NO_PATTERN.test(value)) errors[name] = ACCOUNT_ERRORS.houseNumber;
  });
  return errors;
}
