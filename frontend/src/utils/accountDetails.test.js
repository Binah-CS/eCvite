import {
  ACCOUNT_ERRORS,
  getChangedFields,
  getVisibleAccountFields,
  toFormValues,
  validateAccount,
} from './accountDetails';

describe('getVisibleAccountFields', () => {
  test('shows only fields the server returned, in label order', () => {
    const fields = getVisibleAccountFields(['city', 'lastName'], ['phone']);
    expect(fields.map((field) => field.name)).toEqual(['lastName', 'phone', 'city']);
  });

  test('keeps a server field that has no label yet, at the end', () => {
    const fields = getVisibleAccountFields(['lastName', 'zip'], []);
    expect(fields.map((field) => field.name)).toEqual(['lastName', 'zip']);
    expect(fields[1].label).toBe('zip');
  });
});

describe('toFormValues', () => {
  test('turns missing values into empty strings', () => {
    expect(toFormValues({ lastName: 'כהן', city: null }, ['lastName', 'city', 'street']))
      .toEqual({ lastName: 'כהן', city: '', street: '' });
  });
});

describe('getChangedFields', () => {
  const saved = { lastName: 'כהן', city: 'ירושלים', phone: '0501234567' };

  test('returns trimmed changed editable fields only', () => {
    const current = { ...saved, lastName: ' לוי ', phone: '0509999999' };
    expect(getChangedFields(saved, current, ['lastName', 'city'])).toEqual({ lastName: 'לוי' });
  });

  test('whitespace-only edits are not a change', () => {
    expect(getChangedFields(saved, { ...saved, city: 'ירושלים  ' }, ['lastName', 'city'])).toEqual({});
  });

  test('clearing a field is a change to an empty value', () => {
    expect(getChangedFields(saved, { ...saved, city: '' }, ['city'])).toEqual({ city: '' });
  });
});

describe('validateAccount', () => {
  test('valid changes have no errors', () => {
    expect(validateAccount({ email: 'a.b@gmail.com', houseNumber: '12א' }, ['email'])).toEqual({});
  });

  test('required field cleared', () => {
    expect(validateAccount({ lastName: '  ' }, ['lastName'])).toEqual({ lastName: ACCOUNT_ERRORS.required });
  });

  test('optional field cleared is fine', () => {
    expect(validateAccount({ eventType: '' }, ['lastName'])).toEqual({});
  });

  test('non-Gmail email and bad house number', () => {
    expect(validateAccount({ email: 'a@yahoo.com', houseNumber: '5ab' }, [])).toEqual({
      email: ACCOUNT_ERRORS.email,
      houseNumber: ACCOUNT_ERRORS.houseNumber,
    });
  });

  test('too long value', () => {
    expect(validateAccount({ street: 'א'.repeat(256) }, [])).toEqual({ street: ACCOUNT_ERRORS.tooLong });
  });
});
