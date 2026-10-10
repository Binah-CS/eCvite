import { buildIdentityKey, mergeBelongsToValues } from './recipientIdentity';

// שדות הזהות - בדיוק אותה רשימה שצריכה להתאים גם לנוסחת ה-hash בצד השרת
// (Recipients.java, generateRowHashCode). אם מישהי משנה שדה אחד מהרשימה הזו כאן
// בלי לשנות גם שם, בדיקה הזו עדיין תעבור - אבל הבדיקה המקבילה בג'אווה
// (RecipientsTest.java) תתפוס שהיא כבר לא תואמת לרשימה הזו, ותיכשל
const IDENTITY_FIELDS = ['man', 'woman', 'lastName', 'phone', 'city', 'street', 'houseNo'];
const NON_IDENTITY_FIELDS = ['prefix', 'suffix', 'fatherName', 'motherName', 'mail', 'country', 'belongsTo', 'print'];

const baseRow = {
  man: 'יוסי', woman: 'רותי', lastName: 'כהן', phone: '0501234567',
  city: 'ירושלים', street: 'הרצל', houseNo: '12',
  prefix: 'מר', suffix: 'ומשפחתו', fatherName: 'דוד', motherName: 'שרה',
  mail: 'a@b.com', country: 'ישראל', belongsTo: 'חברים', print: true,
};

describe('buildIdentityKey', () => {
  test.each(IDENTITY_FIELDS)('changing "%s" changes the identity key', (field) => {
    const changed = { ...baseRow, [field]: baseRow[field] + '_שונה' };
    expect(buildIdentityKey(changed)).not.toEqual(buildIdentityKey(baseRow));
  });

  test.each(NON_IDENTITY_FIELDS)('changing "%s" does NOT change the identity key', (field) => {
    const changed = { ...baseRow, [field]: baseRow[field] + '_שונה' };
    expect(buildIdentityKey(changed)).toEqual(buildIdentityKey(baseRow));
  });

  test('missing fields are treated as empty strings, not crashes', () => {
    expect(() => buildIdentityKey({})).not.toThrow();
    expect(buildIdentityKey({})).toBe('||||||');
  });

  test('surrounding whitespace is trimmed before building the key', () => {
    expect(buildIdentityKey({ ...baseRow, man: '  יוסי  ' })).toEqual(buildIdentityKey(baseRow));
  });
});

describe('mergeBelongsToValues', () => {
  test('combines values from multiple sources without duplicates', () => {
    expect(mergeBelongsToValues('צד החתן', 'משפחה, חברים')).toBe('צד החתן, משפחה, חברים');
  });

  test('does not duplicate a value that already appears', () => {
    expect(mergeBelongsToValues('צד החתן, משפחה', 'משפחה')).toBe('צד החתן, משפחה');
  });

  test('trims extra whitespace around each value', () => {
    expect(mergeBelongsToValues('צד החתן ,  משפחה  ')).toBe('צד החתן, משפחה');
  });

  test('ignores empty/null/undefined sources', () => {
    expect(mergeBelongsToValues('צד החתן', null, undefined, '', '   ')).toBe('צד החתן');
  });
});
