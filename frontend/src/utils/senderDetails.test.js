import { ACCOUNT_ERRORS } from './accountDetails';
import {
  ENGLISH_SENDER_FIELDS,
  HEBREW_SENDER_FIELDS,
  getAccountName,
  getVisibleSenderFields,
  hasEnglishDetails,
  isSenderChanged,
  resolveSenderAddress,
  resolveSenderDisplayName,
  toSenderFormValues,
  toSenderPayload,
  validateSender,
} from './senderDetails';

const user = {
  firstNameWoman: 'רחל',
  firstNameMan: '',
  lastName: 'כהן',
  street: 'הרצל',
  houseNumber: '5',
  city: 'ירושלים',
};

const ALL_FIELDS = [...HEBREW_SENDER_FIELDS, ...ENGLISH_SENDER_FIELDS].map((field) => field.name);

describe('getVisibleSenderFields / toSenderFormValues', () => {
  test('only fields the server returned', () => {
    expect(getVisibleSenderFields(HEBREW_SENDER_FIELDS, ['city', 'street']).map((f) => f.name))
      .toEqual(['street', 'city']);
  });

  test('null sender (not saved yet) becomes empty strings', () => {
    expect(toSenderFormValues(null, ['street', 'cityEn'])).toEqual({ street: '', cityEn: '' });
  });
});

describe('display name fallback', () => {
  test('Hebrew uses the sender name when filled', () => {
    expect(resolveSenderDisplayName({ displayName: ' משפחת כהן ' }, user)).toBe('משפחת כהן');
  });

  test('Hebrew falls back to the account name', () => {
    expect(resolveSenderDisplayName({ displayName: '' }, user)).toBe('רחל כהן');
    expect(resolveSenderDisplayName(null, user)).toBe('רחל כהן');
  });

  test('account name falls back to firstNameMan for existing users', () => {
    expect(getAccountName({ firstNameWoman: '', firstNameMan: 'יוסי', lastName: 'לוי' })).toBe('יוסי לוי');
  });

  test('English has no fallback', () => {
    expect(resolveSenderDisplayName({ displayNameEn: '' }, user, 'en')).toBe('');
    expect(resolveSenderDisplayName({ displayNameEn: 'Rachel Cohen' }, user, 'en')).toBe('Rachel Cohen');
  });
});

describe('address fallback', () => {
  test('empty Hebrew address falls back to the account address', () => {
    expect(resolveSenderAddress({ displayName: 'שם' }, user)).toEqual({
      street: 'הרצל', houseNo: '5', city: 'ירושלים', zip: '', country: '',
    });
  });

  test('any Hebrew address field uses the sender address only', () => {
    expect(resolveSenderAddress({ street: 'יפו', city: 'חיפה' }, user)).toEqual({
      street: 'יפו', houseNo: '', city: 'חיפה', zip: '', country: '',
    });
  });

  test('English address has no fallback', () => {
    expect(resolveSenderAddress({}, user, 'en')).toEqual({
      street: '', houseNo: '', city: '', zip: '', country: '',
    });
    expect(resolveSenderAddress({ streetEn: 'Herzl', cityEn: 'Haifa' }, user, 'en').city).toBe('Haifa');
  });
});

describe('change tracking', () => {
  test('isSenderChanged ignores surrounding whitespace', () => {
    expect(isSenderChanged({ street: 'הרצל' }, { street: ' הרצל ' }, ['street'])).toBe(false);
    expect(isSenderChanged({ street: 'הרצל' }, { street: 'יפו' }, ['street'])).toBe(true);
  });

  test('hasEnglishDetails', () => {
    expect(hasEnglishDetails({ street: 'הרצל', cityEn: ' ' })).toBe(false);
    expect(hasEnglishDetails({ cityEn: 'Haifa' })).toBe(true);
  });

  test('toSenderPayload sends every field, trimmed', () => {
    const payload = toSenderPayload({ street: ' הרצל ' }, ALL_FIELDS);
    expect(Object.keys(payload)).toEqual(ALL_FIELDS);
    expect(payload.street).toBe('הרצל');
    expect(payload.cityEn).toBe('');
  });
});

describe('validateSender', () => {
  test('empty sender and name-only sender are valid', () => {
    expect(validateSender({})).toEqual({});
    expect(validateSender({ displayName: 'רחל ויוסי' })).toEqual({});
  });

  test('a Hebrew address field requires street and city', () => {
    expect(validateSender({ zip: '1234567' })).toEqual({
      street: ACCOUNT_ERRORS.required,
      city: ACCOUNT_ERRORS.required,
    });
  });

  test('any English field (even the name) requires English street and city', () => {
    expect(validateSender({ displayNameEn: 'Rachel' })).toEqual({
      streetEn: ACCOUNT_ERRORS.required,
      cityEn: ACCOUNT_ERRORS.required,
    });
  });

  test('format errors', () => {
    expect(validateSender({
      street: 'הרצל', city: 'חיפה', houseNo: '5ab', zip: '123',
      streetEn: 'Herzl', cityEn: 'Haifa', zipEn: '1',
    })).toEqual({
      houseNo: ACCOUNT_ERRORS.houseNumber,
      zip: ACCOUNT_ERRORS.zip,
      zipEn: ACCOUNT_ERRORS.zip,
    });
  });
});
