import { HOUSE_NO_PATTERN, ZIP_IL_REGEX, ZIP_INTL_REGEX } from './validation';
import { ACCOUNT_ERRORS, MAX_LENGTH, normalize } from './accountDetails';

// פרטי השולח למעטפות (טבלה user_senders בשרת). אילו שדות קיימים - מגיע מהשרת
// (SenderFields); כאן רק תוויות, סדר וכללי ה-fallback. שמות שדות הכתובת כמו אצל
// הנמענים (street, houseNo, city, country) + zip, שקיים רק לשולח

export const HEBREW_SENDER_FIELDS = [
  { name: 'displayName', label: 'שם לשליחה' },
  { name: 'street', label: 'רחוב' },
  { name: 'houseNo', label: 'מספר בית' },
  { name: 'city', label: 'עיר' },
  { name: 'zip', label: 'מיקוד' },
  { name: 'country', label: 'ארץ' },
];

export const ENGLISH_SENDER_FIELDS = [
  { name: 'displayNameEn', label: 'שם לשליחה' },
  { name: 'streetEn', label: 'רחוב' },
  { name: 'houseNoEn', label: 'מספר בית' },
  { name: 'cityEn', label: 'עיר' },
  { name: 'zipEn', label: 'מיקוד' },
  { name: 'countryEn', label: 'ארץ' },
];

// ארץ ריקה = ישראל, בשתי השפות. מוצג כ-placeholder בשדה ומוחזר ב-resolveSenderAddress;
// לא נשמר כערך
export const DEFAULT_COUNTRY = { he: 'ישראל', en: 'Israel' };

// ה-placeholder של שדות השולח באנגלית - רק הארץ (לשאר אין fallback)
export const ENGLISH_SENDER_PLACEHOLDERS = { countryEn: DEFAULT_COUNTRY.en };

// אותן קבוצות כמו SenderFields.HEBREW_ADDRESS / ENGLISH בשרת
const HEBREW_FIELDS = HEBREW_SENDER_FIELDS.map((field) => field.name);
const HEBREW_ADDRESS = ['street', 'houseNo', 'city', 'zip', 'country'];
const ENGLISH_FIELDS = ENGLISH_SENDER_FIELDS.map((field) => field.name);

const isFilled = (values, name) => normalize(values?.[name]) !== '';
const anyFilled = (values, names) => names.some((name) => isFilled(values, name));

// השדות להצגה - רק אלה שהשרת החזיר, בסדר של הרשימה
export function getVisibleSenderFields(fieldDefs, senderFieldNames = []) {
  return fieldDefs.filter((field) => senderFieldNames.includes(field.name));
}

export function toSenderFormValues(sender, fieldNames) {
  return Object.fromEntries(fieldNames.map((name) => [name, String(sender?.[name] ?? '')]));
}

// האם יש פרטים באנגלית - קובע אם החלק האנגלי נפתח בטעינה
export function hasEnglishDetails(values) {
  return anyFilled(values, ENGLISH_FIELDS);
}

// האם מולא שדה שולח כלשהו בעברית - קובע אם להציג "שימוש בפרטי החשבון"
export function hasHebrewSenderDetails(values) {
  return anyFilled(values, HEBREW_FIELDS);
}

// ריקון שדות השולח בעברית, כדי שיחזרו ל-fallback של פרטי החשבון
export function clearHebrewSender(values) {
  return { ...values, ...Object.fromEntries(HEBREW_FIELDS.map((name) => [name, ''])) };
}

// ריקון כל שדות האנגלית (כולל countryEn)
export function clearEnglishSender(values) {
  return { ...values, ...Object.fromEntries(ENGLISH_FIELDS.map((name) => [name, ''])) };
}

// שדות השולח שחובה כרגע: רחוב ועיר בעברית אם מולא שדה כתובת בעברית, ורחוב ועיר
// באנגלית אם מולא שדה באנגלית. אותו כלל משמש גם לכוכבית בטופס וגם ל-validateSender,
// כך שהם לא יכולים לצאת מסנכרון
export function getRequiredSenderFields(values) {
  const required = [];
  if (anyFilled(values, HEBREW_ADDRESS)) required.push('street', 'city');
  if (anyFilled(values, ENGLISH_FIELDS)) required.push('streetEn', 'cityEn');
  return required;
}

// ה-placeholder של שדות השולח בעברית = ה-fallback מפרטי החשבון, כך שהשדות נראים
// מלאים כל עוד לא הקלידו בהם (הערך השמור נשאר ריק). שם (שם המשפחה בלבד) וארץ
// (ישראל) - תמיד. כתובת - רק כשלא מולא אף שדה כתובת, כי ה-fallback של הכתובת הוא
// הכול או כלום (ר' resolveSenderAddress)
export function getHebrewSenderPlaceholders(values, accountValues) {
  const placeholders = { displayName: getSenderFallbackName(accountValues), country: DEFAULT_COUNTRY.he };
  if (!anyFilled(values, HEBREW_ADDRESS)) {
    const address = resolveSenderAddress(null, accountValues);
    placeholders.street = address.street;
    placeholders.houseNo = address.houseNo;
    placeholders.city = address.city;
  }
  return placeholders;
}

export function isSenderChanged(savedValues, currentValues, fieldNames = []) {
  return fieldNames.some((name) => normalize(savedValues?.[name]) !== normalize(currentValues?.[name]));
}

// השולח המלא לשליחה לשרת (אחרי trim) - השרת מחליף את כל השדות בבת אחת
export function toSenderPayload(values, fieldNames = []) {
  return Object.fromEntries(fieldNames.map((name) => [name, normalize(values?.[name])]));
}

// ה-fallback של שם השולח בעברית: שם המשפחה מהחשבון בלבד, בלי השם הפרטי (השולח הוא
// המשפחה, לא המשתמשת עצמה)
export function getSenderFallbackName(user) {
  return normalize(user?.lastName);
}

// השם שיודפס כשולח. בעברית: "שם לשליחה", ואם ריק - שם המשפחה מהחשבון. באנגלית אין
// fallback (פרטי החשבון בעברית), ולכן ריק = אין שם באנגלית
export function resolveSenderDisplayName(sender, user, language = 'he') {
  if (language === 'en') return normalize(sender?.displayNameEn);
  return normalize(sender?.displayName) || getSenderFallbackName(user);
}

// הכתובת שתודפס כשולח, באותו מבנה כמו כתובת נמען. בעברית: אם לא מולא אף שדה
// כתובת - כתובת החשבון (בחשבון אין מיקוד וארץ). באנגלית - רק מה שמולא, בלי fallback.
// ארץ ריקה = ישראל בכל המקרים (DEFAULT_COUNTRY)
export function resolveSenderAddress(sender, user, language = 'he') {
  if (language === 'en') {
    return {
      street: normalize(sender?.streetEn),
      houseNo: normalize(sender?.houseNoEn),
      city: normalize(sender?.cityEn),
      zip: normalize(sender?.zipEn),
      country: normalize(sender?.countryEn) || DEFAULT_COUNTRY.en,
    };
  }
  if (HEBREW_ADDRESS.some((name) => isFilled(sender, name))) {
    return {
      ...Object.fromEntries(HEBREW_ADDRESS.map((name) => [name, normalize(sender?.[name])])),
      country: normalize(sender?.country) || DEFAULT_COUNTRY.he,
    };
  }
  return {
    street: normalize(user?.street),
    houseNo: normalize(user?.houseNumber),
    city: normalize(user?.city),
    zip: '',
    country: DEFAULT_COUNTRY.he,
  };
}

// אותם כללים כמו AccountValidation.validateSender בשרת: פורמט לכל שדה, ואם מולא
// שדה כתובת בעברית / שדה באנגלית - רחוב ועיר באותה שפה חובה
export function validateSender(values) {
  const errors = {};
  Object.entries(values ?? {}).forEach(([name, raw]) => {
    const value = normalize(raw);
    if (!value) return;
    if (value.length > MAX_LENGTH) errors[name] = ACCOUNT_ERRORS.tooLong;
    else if ((name === 'houseNo' || name === 'houseNoEn') && !HOUSE_NO_PATTERN.test(value)) {
      errors[name] = ACCOUNT_ERRORS.houseNumber;
    } else if (name === 'zip' && !ZIP_IL_REGEX.test(value)) errors[name] = ACCOUNT_ERRORS.zip;
    else if (name === 'zipEn' && !ZIP_INTL_REGEX.test(value)) errors[name] = ACCOUNT_ERRORS.zip;
  });

  getRequiredSenderFields(values).forEach((name) => {
    if (!isFilled(values, name) && !errors[name]) errors[name] = ACCOUNT_ERRORS.required;
  });
  return errors;
}
