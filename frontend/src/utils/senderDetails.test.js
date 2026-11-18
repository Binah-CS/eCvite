import { ACCOUNT_ERRORS } from './accountDetails';
import {
  ENGLISH_SENDER_FIELDS,
  ENGLISH_SENDER_PLACEHOLDERS,
  HEBREW_SENDER_FIELDS,
  clearEnglishSender,
  clearHebrewSender,
  getSenderFallbackName,
  getHebrewSenderPlaceholders,
  getRequiredSenderFields,
  getVisibleSenderFields,
  hasEnglishDetails,
  hasHebrewSenderDetails,
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

  test('Hebrew falls back to the account last name only, without the first name', () => {
    expect(resolveSenderDisplayName({ displayName: '' }, user)).toBe('כהן');
    expect(resolveSenderDisplayName(null, user)).toBe('כהן');
  });

  test('fallback name ignores both first-name fields', () => {
    expect(getSenderFallbackName({ firstNameWoman: 'רחל', firstNameMan: 'יוסי', lastName: ' לוי ' })).toBe('לוי');
    expect(getSenderFallbackName({ firstNameWoman: 'רחל', lastName: '' })).toBe('');
  });

  test('English has no fallback', () => {
    expect(resolveSenderDisplayName({ displayNameEn: '' }, user, 'en')).toBe('');
    expect(resolveSenderDisplayName({ displayNameEn: 'Rachel Cohen' }, user, 'en')).toBe('Rachel Cohen');
  });
});

describe('address fallback', () => {
  test('empty Hebrew address falls back to the account address, country Israel', () => {
    expect(resolveSenderAddress({ displayName: 'שם' }, user)).toEqual({
      street: 'הרצל', houseNo: '5', city: 'ירושלים', zip: '', country: 'ישראל',
    });
  });

  test('any Hebrew address field uses the sender address only; empty country is Israel', () => {
    expect(resolveSenderAddress({ street: 'יפו', city: 'חיפה' }, user)).toEqual({
      street: 'יפו', houseNo: '', city: 'חיפה', zip: '', country: 'ישראל',
    });
    expect(resolveSenderAddress({ street: 'Rue', city: 'Paris', country: 'צרפת' }, user).country).toBe('צרפת');
  });

  test('English address has no fallback except the country (Israel)', () => {
    expect(resolveSenderAddress({}, user, 'en')).toEqual({
      street: '', houseNo: '', city: '', zip: '', country: 'Israel',
    });
    expect(resolveSenderAddress({ streetEn: 'Herzl', cityEn: 'Haifa' }, user, 'en').city).toBe('Haifa');
    expect(resolveSenderAddress({ countryEn: 'France' }, user, 'en').country).toBe('France');
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

  test('a typed countryEn counts as English details, like any English field', () => {
    expect(hasEnglishDetails({ countryEn: 'France' })).toBe(true);
  });

  test('hasHebrewSenderDetails counts any Hebrew field, including name and country', () => {
    expect(hasHebrewSenderDetails({ cityEn: 'Haifa' })).toBe(false);
    expect(hasHebrewSenderDetails({ displayName: 'רחל' })).toBe(true);
    expect(hasHebrewSenderDetails({ country: 'ישראל' })).toBe(true);
  });

  test('toSenderPayload sends every field, trimmed', () => {
    const payload = toSenderPayload({ street: ' הרצל ' }, ALL_FIELDS);
    expect(Object.keys(payload)).toEqual(ALL_FIELDS);
    expect(payload.street).toBe('הרצל');
    expect(payload.cityEn).toBe('');
  });
});

describe('clear helpers', () => {
  const filled = {
    displayName: 'רחל', street: 'יפו', houseNo: '3', city: 'חיפה', zip: '1234567', country: 'ישראל',
    displayNameEn: 'Rachel', streetEn: 'Jaffa', countryEn: 'Israel',
  };

  test('clearHebrewSender empties only the Hebrew fields', () => {
    const cleared = clearHebrewSender(filled);
    expect(hasHebrewSenderDetails(cleared)).toBe(false);
    expect(cleared.streetEn).toBe('Jaffa');
    expect(cleared.countryEn).toBe('Israel');
  });

  test('clearEnglishSender empties all English fields, including countryEn', () => {
    const cleared = clearEnglishSender(filled);
    expect(ENGLISH_SENDER_FIELDS.every(({ name }) => cleared[name] === '')).toBe(true);
    expect(cleared.street).toBe('יפו');
  });
});

describe('getRequiredSenderFields (asterisks)', () => {
  test('nothing filled - nothing required', () => {
    expect(getRequiredSenderFields({})).toEqual([]);
  });

  test('name only is not an address - nothing required', () => {
    expect(getRequiredSenderFields({ displayName: 'רחל' })).toEqual([]);
  });

  test('a Hebrew address field requires Hebrew street and city', () => {
    expect(getRequiredSenderFields({ zip: '1234567' })).toEqual(['street', 'city']);
  });

  test('a typed country counts as an address field in both languages', () => {
    expect(getRequiredSenderFields({ country: 'צרפת' })).toEqual(['street', 'city']);
    expect(getRequiredSenderFields({ countryEn: 'France' })).toEqual(['streetEn', 'cityEn']);
  });
});

describe('placeholders', () => {
  test('empty sender shows the account name and address, and Israel as country', () => {
    expect(getHebrewSenderPlaceholders({}, user)).toEqual({
      displayName: 'כהן', street: 'הרצל', houseNo: '5', city: 'ירושלים', country: 'ישראל',
    });
  });

  test('once a Hebrew address field is filled, account-address placeholders are dropped; the country one stays', () => {
    expect(getHebrewSenderPlaceholders({ street: 'יפו' }, user)).toEqual({ displayName: 'כהן', country: 'ישראל' });
  });

  test('English placeholder is only the country', () => {
    expect(ENGLISH_SENDER_PLACEHOLDERS).toEqual({ countryEn: 'Israel' });
  });

  test('a typed name does not affect the address placeholders', () => {
    expect(getHebrewSenderPlaceholders({ displayName: 'משפחת כהן' }, user).city).toBe('ירושלים');
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
