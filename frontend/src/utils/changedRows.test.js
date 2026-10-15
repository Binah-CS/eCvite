import { buildSavedSnapshot, rowSignature, selectRowsToSave } from './changedRows';

const savedRow = {
  hashCode: 'h1', man: 'יוסי', lastName: 'כהן', city: 'ירושלים', phone: null, print: false,
};

describe('selectRowsToSave', () => {
  test('unchanged saved rows are not sent', () => {
    const snapshot = buildSavedSnapshot([savedRow]);
    // DataTable מוסיף id לכל שורה - זה לא נחשב שינוי
    expect(selectRowsToSave([{ ...savedRow, id: 'h1' }], snapshot)).toEqual([]);
  });

  test('a row whose content changed is sent', () => {
    const snapshot = buildSavedSnapshot([savedRow]);
    const edited = { ...savedRow, id: 'h1', city: 'בני ברק' };
    expect(selectRowsToSave([edited], snapshot)).toEqual([edited]);
  });

  test('a new row without hashCode is always sent', () => {
    const newRow = { id: 7, man: 'חדש' };
    expect(selectRowsToSave([newRow], buildSavedSnapshot([savedRow]))).toEqual([newRow]);
  });

  test('a saved row missing from the snapshot is sent (e.g. loaded from local backup)', () => {
    expect(selectRowsToSave([savedRow], new Map())).toEqual([savedRow]);
  });

  test('only changed and new rows are picked out of a large table', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ hashCode: `h${i}`, man: `נמען${i}` }));
    const snapshot = buildSavedSnapshot(rows);
    const table = rows.map((r) => ({ ...r, id: r.hashCode }));
    table[10] = { ...table[10], city: 'חיפה' };
    table.unshift({ id: 1, man: 'שורה חדשה' });

    const toSave = selectRowsToSave(table, snapshot);
    expect(toSave.map((r) => r.man)).toEqual(['שורה חדשה', 'נמען10']);
  });
});

describe('rowSignature', () => {
  test('null, undefined and empty string are treated as the same empty value', () => {
    expect(rowSignature({ hashCode: 'h', phone: null })).toBe(rowSignature({ hashCode: 'h', phone: '' }));
    expect(rowSignature({ hashCode: 'h', phone: '' })).toBe(rowSignature({ hashCode: 'h' }));
  });

  test('field order does not matter', () => {
    expect(rowSignature({ a: '1', b: '2' })).toBe(rowSignature({ b: '2', a: '1' }));
  });

  test('false is a real value, not empty', () => {
    expect(rowSignature({ print: false })).not.toBe(rowSignature({ print: true }));
    expect(rowSignature({ print: false })).not.toBe(rowSignature({}));
  });

  test('printEnabled is ignored - it is saved on its own, not through save', () => {
    expect(rowSignature({ man: 'א', printEnabled: false })).toBe(rowSignature({ man: 'א', printEnabled: true }));
    const snapshot = buildSavedSnapshot([{ hashCode: 'h1', man: 'א', printEnabled: true }]);
    expect(selectRowsToSave([{ hashCode: 'h1', man: 'א', printEnabled: false }], snapshot)).toEqual([]);
  });

  test('duplicateSalt is ignored', () => {
    expect(rowSignature({ man: 'א', duplicateSalt: 'x' })).toBe(rowSignature({ man: 'א' }));
  });
});
