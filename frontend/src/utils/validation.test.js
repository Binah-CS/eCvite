import { GMAIL_REGEX, HOUSE_NO_PATTERN, PHONE_REGEX, ZIP_IL_REGEX, ZIP_INTL_REGEX } from './validation';

// הביטויים מוכפלים ב-AccountValidation בשרת (ר' UserControllerTest) - הדוגמאות כאן
// מתעדות את ההתנהגות הצפויה בשני הצדדים
describe('validation regexes', () => {
  test('PHONE_REGEX accepts mobile and landline numbers', () => {
    expect(PHONE_REGEX.test('0501234567')).toBe(true);
    expect(PHONE_REGEX.test('021234567')).toBe(true);
    expect(PHONE_REGEX.test('123')).toBe(false);
    expect(PHONE_REGEX.test('0611234567')).toBe(false);
  });

  test('GMAIL_REGEX accepts Gmail only', () => {
    expect(GMAIL_REGEX.test('rachel@gmail.com')).toBe(true);
    expect(GMAIL_REGEX.test('rachel@yahoo.com')).toBe(false);
    expect(GMAIL_REGEX.test('rachel@gmail.com.il')).toBe(false);
  });

  test('HOUSE_NO_PATTERN allows digits with one optional letter', () => {
    expect(HOUSE_NO_PATTERN.test('5')).toBe(true);
    expect(HOUSE_NO_PATTERN.test('12א')).toBe(true);
    expect(HOUSE_NO_PATTERN.test('12b')).toBe(true);
    expect(HOUSE_NO_PATTERN.test('5ab')).toBe(false);
    expect(HOUSE_NO_PATTERN.test('א5')).toBe(false);
  });

  test('ZIP_IL_REGEX requires exactly 7 digits', () => {
    expect(ZIP_IL_REGEX.test('1234567')).toBe(true);
    expect(ZIP_IL_REGEX.test('123')).toBe(false);
    expect(ZIP_IL_REGEX.test('12345678')).toBe(false);
  });

  test('ZIP_INTL_REGEX allows 3-10 letters/digits with inner space or dash', () => {
    expect(ZIP_INTL_REGEX.test('SW1A 1AA')).toBe(true);
    expect(ZIP_INTL_REGEX.test('10001')).toBe(true);
    expect(ZIP_INTL_REGEX.test('12345-6789')).toBe(true);
    expect(ZIP_INTL_REGEX.test('12')).toBe(false);
    expect(ZIP_INTL_REGEX.test(' 123')).toBe(false);
    expect(ZIP_INTL_REGEX.test('12345678901')).toBe(false);
  });
});
