import { HOUSE_NO_PATTERN, ZIP_IL_REGEX, ZIP_INTL_REGEX } from './validation';
import { ACCOUNT_ERRORS, MAX_LENGTH, getDisplayFirstName, normalize } from './accountDetails';

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

// אותן קבוצות כמו SenderFields.HEBREW_ADDRESS / ENGLISH בשרת
const HEBREW_ADDRESS = ['street', 'houseNo', 'city', 'zip', 'country'];
const ENGLISH_FIELDS = ENGLISH_SENDER_FIELDS.map((field) => field.name);

const isFilled = (values, name) => normalize(values?.[name]) !== '';

// השדות להצגה - רק אלה שהשרת החזיר, בסדר של הרשימה
export function getVisibleSenderFields(fieldDefs, senderFieldNames = []) {
  return fieldDefs.filter((field) => senderFieldNames.includes(field.name));
}

export function toSenderFormValues(sender, fieldNames) {
  return Object.fromEntries(fieldNames.map((name) => [name, String(sender?.[name] ?? '')]));
}

export function hasEnglishDetails(values) {
  return ENGLISH_FIELDS.some((name) => isFilled(values, name));
}

export function isSenderChanged(savedValues, currentValues, fieldNames = []) {
  return fieldNames.some((name) => normalize(savedValues?.[name]) !== normalize(currentValues?.[name]));
}

// השולח המלא לשליחה לשרת (אחרי trim) - השרת מחליף את כל השדות בבת אחת
export function toSenderPayload(values, fieldNames = []) {
  return Object.fromEntries(fieldNames.map((name) => [name, normalize(values?.[name])]));
}

// שם החשבון (שם פרטי + משפחה) - ה-fallback של שם השולח בעברית
export function getAccountName(user) {
  return [getDisplayFirstName(user, ''), normalize(user?.lastName)].filter(Boolean).join(' ');
}

// השם שיודפס כשולח. בעברית: "שם לשליחה", ואם ריק - שם החשבון. באנגלית אין fallback
// (פרטי החשבון בעברית), ולכן ריק = אין שם באנגלית
export function resolveSenderDisplayName(sender, user, language = 'he') {
  if (language === 'en') return normalize(sender?.displayNameEn);
  return normalize(sender?.displayName) || getAccountName(user);
}

// הכתובת שתודפס כשולח, באותו מבנה כמו כתובת נמען. בעברית: אם לא מולא אף שדה
// כתובת - כתובת החשבון (בחשבון אין מיקוד וארץ). באנגלית - רק מה שמולא, בלי fallback
export function resolveSenderAddress(sender, user, language = 'he') {
  if (language === 'en') {
    return {
      street: normalize(sender?.streetEn),
      houseNo: normalize(sender?.houseNoEn),
      city: normalize(sender?.cityEn),
      zip: normalize(sender?.zipEn),
      country: normalize(sender?.countryEn),
    };
  }
  if (HEBREW_ADDRESS.some((name) => isFilled(sender, name))) {
    return Object.fromEntries(HEBREW_ADDRESS.map((name) => [name, normalize(sender?.[name])]));
  }
  return {
    street: normalize(user?.street),
    houseNo: normalize(user?.houseNumber),
    city: normalize(user?.city),
    zip: '',
    country: '',
  };
}

// אותם כללים כמו AccountValidation.validateSender בשרת: פורמט לכל שדה, ואם מולא
// שדה כתובת בעברית / שדה כלשהו באנגלית - רחוב ועיר באותה שפה חובה
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

  const requireStreetAndCity = (group, streetField, cityField) => {
    if (!group.some((name) => isFilled(values, name))) return;
    [streetField, cityField].forEach((name) => {
      if (!isFilled(values, name) && !errors[name]) errors[name] = ACCOUNT_ERRORS.required;
    });
  };
  requireStreetAndCity(HEBREW_ADDRESS, 'street', 'city');
  requireStreetAndCity(ENGLISH_FIELDS, 'streetEn', 'cityEn');
  return errors;
}
