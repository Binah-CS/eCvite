import { applyBulkRecipientEdit } from './bulkRecipientEdit';

const rows = [
  { id: 'h1', hashCode: 'h1', suffix: 'משפחת', city: 'ירושלים', belongsTo: 'עבודה' },
  { id: 'h2', hashCode: 'h2', suffix: '', city: 'חיפה', belongsTo: 'שכנים' },
  { id: 3, suffix: 'ד"ר', city: 'בני ברק', belongsTo: '' },
];

describe('applyBulkRecipientEdit', () => {
  test('updates only selected rows for a regular text field', () => {
    const result = applyBulkRecipientEdit(rows, ['h1', 'h2'], 'suffix', 'לכבוד');

    expect(result.map((row) => row.suffix)).toEqual(['לכבוד', 'לכבוד', 'ד"ר']);
    expect(result[2]).toBe(rows[2]);
  });

  test('uses the local id for a new unsaved row', () => {
    const result = applyBulkRecipientEdit(rows, [3], 'city', 'מודיעין');

    expect(result[2].city).toBe('מודיעין');
    expect(result[0]).toBe(rows[0]);
  });

  test('replaces belongs-to values, including clearing them', () => {
    const result = applyBulkRecipientEdit(rows, ['h1'], 'belongsTo', 'משפחה');
    const cleared = applyBulkRecipientEdit(rows, ['h2'], 'belongsTo', '');

    expect(result[0].belongsTo).toBe('משפחה');
    expect(cleared[1].belongsTo).toBe('');
  });

  test('appends belongs-to values without duplicates for each selected row', () => {
    const result = applyBulkRecipientEdit(rows, ['h1', 'h2'], 'belongsTo', 'עבודה', 'append');

    expect(result[0].belongsTo).toBe('עבודה');
    expect(result[1].belongsTo).toBe('שכנים, עבודה');
  });

  test('keeps object identity when the requested change has no effect', () => {
    const result = applyBulkRecipientEdit(rows, ['h1'], 'city', 'ירושלים');

    expect(result[0]).toBe(rows[0]);
  });
});
