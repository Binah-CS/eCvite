import {
  EMPTY_VALUE,
  applyColumnFilters,
  buildColumnFilter,
  cellValues,
  collectColumnValues,
  conditionsToFilters,
  withoutColumnFilter,
} from './columnFilters';

const rows = [
  { id: 1, city: 'בני ברק', belongsTo: 'משפחה', print: true },
  { id: 2, city: 'ירושלים', belongsTo: 'משפחה, חברים', print: false },
  { id: 3, city: 'בני ברק ', belongsTo: 'עבודה', print: true },
  { id: 4, city: 'אלעד', belongsTo: '', print: true },
  { id: 5, city: null, belongsTo: 'חברים', print: true },
];

const ids = (list) => list.map((row) => row.id);

describe('cellValues', () => {
  test('trims text and treats missing values as empty', () => {
    expect(cellValues({ city: ' בני ברק ' }, 'city')).toEqual(['בני ברק']);
    expect(cellValues({ city: null }, 'city')).toEqual([EMPTY_VALUE]);
  });

  test('splits multi-value fields', () => {
    expect(cellValues({ belongsTo: 'משפחה, חברים' }, 'belongsTo')).toEqual(['משפחה', 'חברים']);
    expect(cellValues({ belongsTo: '' }, 'belongsTo')).toEqual([EMPTY_VALUE]);
  });

  test('print is yes/no', () => {
    expect(cellValues({ print: true }, 'print')).toEqual(['כן']);
    expect(cellValues({ print: false }, 'print')).toEqual(['לא']);
  });
});

describe('collectColumnValues', () => {
  test('counts each value, sorted, empty last', () => {
    expect(collectColumnValues(rows, 'city')).toEqual([
      { value: 'אלעד', count: 1 },
      { value: 'בני ברק', count: 2 },
      { value: 'ירושלים', count: 1 },
      { value: EMPTY_VALUE, count: 1 },
    ]);
  });
});

describe('buildColumnFilter', () => {
  const all = ['אלעד', 'בני ברק', 'ירושלים', EMPTY_VALUE];

  test('everything checked - no filter', () => {
    expect(buildColumnFilter(all, new Set(all), 'exclude')).toBeNull();
    expect(buildColumnFilter(all, new Set(all), 'include')).toBeNull();
  });

  test('cleared all and checked - include the checked', () => {
    expect(buildColumnFilter(all, new Set(['בני ברק']), 'include')).toEqual({ mode: 'include', values: ['בני ברק'] });
  });

  test('unchecked from all - exclude the unchecked, even when few remain checked', () => {
    expect(buildColumnFilter(all, new Set(['אלעד']), 'exclude'))
      .toEqual({ mode: 'exclude', values: ['בני ברק', 'ירושלים', EMPTY_VALUE] });
  });
});

describe('conditionsToFilters', () => {
  test('complete conditions become filters, incomplete ones are ignored', () => {
    expect(conditionsToFilters([
      { field: 'city', mode: 'exclude', values: ['בני ברק'] },
      { field: 'belongsTo', mode: 'include', values: [] },
      { field: '', mode: 'include', values: ['x'] },
    ])).toEqual({ city: { mode: 'exclude', values: ['בני ברק'] } });
  });
});

describe('applyColumnFilters', () => {
  test('only Bnei Brak', () => {
    expect(ids(applyColumnFilters(rows, { city: { mode: 'include', values: ['בני ברק'] } }))).toEqual([1, 3]);
  });

  test('Bnei Brak or Jerusalem (OR)', () => {
    expect(ids(applyColumnFilters(rows, { city: { mode: 'include', values: ['בני ברק', 'ירושלים'] } })))
      .toEqual([1, 2, 3]);
  });

  test('everyone except Bnei Brak and Jerusalem (NOT), including empty city', () => {
    expect(ids(applyColumnFilters(rows, { city: { mode: 'exclude', values: ['בני ברק', 'ירושלים'] } })))
      .toEqual([4, 5]);
  });

  test('two columns (AND)', () => {
    const filters = {
      city: { mode: 'include', values: ['בני ברק', 'ירושלים'] },
      belongsTo: { mode: 'include', values: ['משפחה'] },
    };
    expect(ids(applyColumnFilters(rows, filters))).toEqual([1, 2]);
  });

  test('multi-value row passes if any of its values is checked', () => {
    expect(ids(applyColumnFilters(rows, { belongsTo: { mode: 'exclude', values: ['משפחה'] } })))
      .toEqual([2, 3, 4, 5]);
  });

  test('a new value after "only" is hidden, after "except" is shown', () => {
    const withHaifa = [...rows, { id: 6, city: 'חיפה' }];
    expect(ids(applyColumnFilters(withHaifa, { city: { mode: 'include', values: ['בני ברק'] } }))).not.toContain(6);
    expect(ids(applyColumnFilters(withHaifa, { city: { mode: 'exclude', values: ['בני ברק'] } }))).toContain(6);
  });

  test('no filters - same rows', () => {
    expect(applyColumnFilters(rows, {})).toBe(rows);
  });
});

test('withoutColumnFilter drops only that column', () => {
  expect(withoutColumnFilter({ city: { mode: 'include', values: ['א'] }, print: null }, 'city')).toEqual({ print: null });
});
