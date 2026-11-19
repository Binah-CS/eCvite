import { buildAddressNoteLine } from './PrintPreviewPage';

const printOn = () => true;
const printOff = () => false;

test('address note is printed when it has a value and printing is on', () => {
  expect(buildAddressNoteLine({ addressNote: 'Flat 2' }, printOn)).toBe('Flat 2');
});

test('address note is trimmed', () => {
  expect(buildAddressNoteLine({ addressNote: '  Flat 2  ' }, printOn)).toBe('Flat 2');
});

test('address note is not printed when it is empty, only spaces or missing', () => {
  expect(buildAddressNoteLine({ addressNote: '' }, printOn)).toBe('');
  expect(buildAddressNoteLine({ addressNote: '   ' }, printOn)).toBe('');
  expect(buildAddressNoteLine({ addressNote: null }, printOn)).toBe('');
  expect(buildAddressNoteLine({}, printOn)).toBe('');
});

test('address note is not printed when printing is off', () => {
  expect(buildAddressNoteLine({ addressNote: 'Flat 2' }, printOff)).toBe('');
});
