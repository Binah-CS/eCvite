import api from '../services/api';
import { refreshExcelColumns } from '../services/excelColumnsCache';
import { hasColumnPrefsChanged, resolveColumnFlag, saveColumnPreferences } from './columnPreferences';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { updateColumnPreferences: jest.fn() },
}));
jest.mock('../services/excelColumnsCache', () => ({
  refreshExcelColumns: jest.fn(() => Promise.resolve()),
}));

const fieldDefs = [
  { technicalName: 'city', defaultOrder: 3 },
  { technicalName: 'mail', defaultOrder: null },
];

describe('resolveColumnFlag', () => {
  test('uses the saved value when there is one', () => {
    expect(resolveColumnFlag({ city: { show: false } }, fieldDefs, 'city', 'show')).toBe(false);
  });

  test('defaults: show by defaultOrder, print by PRINT_DEFAULT_FIELDS', () => {
    expect(resolveColumnFlag({}, fieldDefs, 'city', 'show')).toBe(true);
    expect(resolveColumnFlag({}, fieldDefs, 'mail', 'show')).toBe(false);
    expect(resolveColumnFlag({}, fieldDefs, 'city', 'print')).toBe(true);
    expect(resolveColumnFlag({}, fieldDefs, 'mail', 'print')).toBe(false);
  });
});

describe('hasColumnPrefsChanged', () => {
  test('no change', () => {
    expect(hasColumnPrefsChanged({}, {}, fieldDefs)).toBe(false);
  });

  test('a toggled flag is a change', () => {
    expect(hasColumnPrefsChanged({}, { city: { show: false, print: true } }, fieldDefs)).toBe(true);
  });

  test('toggling and toggling back is not a change, even with explicit values left in the prefs', () => {
    expect(hasColumnPrefsChanged({}, { city: { show: true, print: true } }, fieldDefs)).toBe(false);
  });

  test('the dragged column order (__order) does not count', () => {
    expect(hasColumnPrefsChanged({ __order: ['city'] }, { __order: ['mail', 'city'] }, fieldDefs)).toBe(false);
  });
});

describe('saveColumnPreferences', () => {
  const user = { phone: '0501234567', columnPreferences: '{}' };

  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('server success: returns true and stores the server user', async () => {
    api.updateColumnPreferences.mockResolvedValue({ data: { ...user, columnPreferences: '{"a":1}' } });

    await expect(saveColumnPreferences(user, '{"a":1}')).resolves.toBe(true);
    expect(JSON.parse(sessionStorage.getItem('user')).columnPreferences).toBe('{"a":1}');
    expect(refreshExcelColumns).toHaveBeenCalled();
  });

  test('server failure, default mode (table dragging): returns false and still saves locally', async () => {
    api.updateColumnPreferences.mockRejectedValue(new Error('network'));

    await expect(saveColumnPreferences(user, '{"b":2}')).resolves.toBe(false);
    expect(JSON.parse(sessionStorage.getItem('user')).columnPreferences).toBe('{"b":2}');
  });

  test('server failure with keepLocalOnFailure: false (column page): returns false and writes nothing', async () => {
    sessionStorage.setItem('user', JSON.stringify(user));
    api.updateColumnPreferences.mockRejectedValue(new Error('network'));

    await expect(saveColumnPreferences(user, '{"b":2}', { keepLocalOnFailure: false })).resolves.toBe(false);
    expect(JSON.parse(sessionStorage.getItem('user')).columnPreferences).toBe('{}');
    expect(refreshExcelColumns).not.toHaveBeenCalled();
  });

  test('server success with keepLocalOnFailure: false still stores the server user', async () => {
    api.updateColumnPreferences.mockResolvedValue({ data: { ...user, columnPreferences: '{"c":3}' } });

    await expect(saveColumnPreferences(user, '{"c":3}', { keepLocalOnFailure: false })).resolves.toBe(true);
    expect(JSON.parse(sessionStorage.getItem('user')).columnPreferences).toBe('{"c":3}');
  });
});
