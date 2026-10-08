import {
  findInvalidRecipientCells,
  isBlank,
  isRecipientValueInvalid,
  isValidGmail,
  isValidIsraeliPhone,
  isValidPersonName,
} from './inputValidation';

describe('registration input validation', () => {
  it.each(['0501234567', '021234567', '091234567'])('accepts a valid Israeli phone number: %s', (phone) => {
    expect(isValidIsraeliPhone(phone)).toBe(true);
  });

  it.each(['050123456', '1501234567', '05A1234567', '05012345678'])('rejects an invalid phone number: %s', (phone) => {
    expect(isValidIsraeliPhone(phone)).toBe(false);
  });

  it('accepts a Gmail address and rejects malformed or unsupported addresses', () => {
    expect(isValidGmail('name.test+event@gmail.com')).toBe(true);
    expect(isValidGmail('name@example.com')).toBe(false);
    expect(isValidGmail('not-an-email')).toBe(false);
  });
});

describe('recipient input validation', () => {
  it.each(['דוד כהן', 'Jean-Luc', "ד'אור"])('accepts a valid person name: %s', (name) => {
    expect(isValidPersonName(name)).toBe(true);
  });

  it.each(['דוד2', '123', 'דוד!', ''])('rejects an invalid person name: %s', (name) => {
    expect(isValidPersonName(name)).toBe(false);
  });

  it('accepts a house number with an optional trailing letter only', () => {
    expect(isRecipientValueInvalid('houseNo', '12')).toBe(false);
    expect(isRecipientValueInvalid('houseNo', '12א')).toBe(false);
    expect(isRecipientValueInvalid('houseNo', '12B')).toBe(false);
    expect(isRecipientValueInvalid('houseNo', '12-2')).toBe(true);
    expect(isRecipientValueInvalid('houseNo', 'רחוב 12')).toBe(true);
  });

  it('rejects digits in name fields while allowing empty optional values', () => {
    expect(isRecipientValueInvalid('man', 'דוד2')).toBe(true);
    expect(isRecipientValueInvalid('lastName', 'כהן')).toBe(false);
    expect(isRecipientValueInvalid('woman', '')).toBe(false);
    expect(isBlank('   ')).toBe(true);
  });

  it('finds required empty values and invalid values in the same row', () => {
    const problems = findInvalidRecipientCells(
      [{ id: 7, man: 'דוד2', lastName: '   ', houseNo: '12-2', city: 'ירושלים' }],
      [
        { technicalName: 'man', isRequired: true },
        { technicalName: 'lastName', isRequired: true },
        { technicalName: 'houseNo', isRequired: false },
        { technicalName: 'city', isRequired: true },
      ]
    );

    expect(problems).toEqual([
      { id: 7, field: 'man' },
      { id: 7, field: 'lastName' },
      { id: 7, field: 'houseNo' },
    ]);
  });
});
