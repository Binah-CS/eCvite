// ביטויי ולידציה משותפים (הרשמה, פרטי חשבון, טבלת הנמענים) - מקום אחד במקום עותק
// בכל קומפוננטה. GMAIL_REGEX ו-HOUSE_NO_PATTERN זהים ל-AccountValidation בצד השרת -
// שינוי כאן צריך להיעשות גם שם

// נייד (05 + 8 ספרות) או קווי (02/03/04/08/09 + 7 ספרות)
export const PHONE_REGEX = /^(05\d{8}|0[23489]\d{7})$/;

// כרגע מתקבלים רק חשבונות Gmail (כמו בהרשמה)
export const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

// מספר בית: ספרות, ואפשר אות אחת בסוף (כמו "12" או "12א")
export const HOUSE_NO_PATTERN = /^\d+[a-zA-Zא-ת]?$/;

// מיקוד ישראלי - 7 ספרות
export const ZIP_IL_REGEX = /^\d{7}$/;

// מיקוד בחו"ל - 3 עד 10 תווים: אותיות/ספרות, ורווח או מקף באמצע (כמו "SW1A 1AA")
export const ZIP_INTL_REGEX = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;
