import {
  matchByValues,
  matchExcelHeaders,
  remapRows,
} from './excelColumnMatcher';

const columns = [
  {
    technicalName: 'lastName',
    displayName: 'שם משפחה',
    aliases: 'משפחה, שם משפחה קודם',
  },
  {
    technicalName: 'prefix',
    displayName: 'תואר',
    possibleValues: ['הרב', 'מר', 'גב'],
  },
];

describe('matchExcelHeaders', () => {
  it('matches technical names, display names, and aliases despite case and whitespace', () => {
    expect(matchExcelHeaders([' lastname ', 'שם משפחה', 'משפחה', 'לא מוכר'], columns)).toEqual({
      matched: {
        ' lastname ': 'lastName',
        'שם משפחה': 'lastName',
        'משפחה': 'lastName',
      },
      unmatched: ['לא מוכר'],
    });
  });
});

describe('matchByValues', () => {
  it('matches a column only when more than half of its distinct values are known', () => {
    const result = matchByValues(
      ['כותרת תואר', 'כותרת לא מזוהה'],
      [
        { 'כותרת תואר': 'הרב', 'כותרת לא מזוהה': 'אחד' },
        { 'כותרת תואר': ' מר ', 'כותרת לא מזוהה': 'שתיים' },
        { 'כותרת תואר': 'ערך אחר', 'כותרת לא מזוהה': 'שלוש' },
      ],
      columns
    );

    expect(result).toEqual({
      matched: { 'כותרת תואר': 'prefix' },
      unmatched: ['כותרת לא מזוהה'],
    });
  });

  it('keeps an empty source column unmatched', () => {
    expect(matchByValues(['ריק'], [{ ריק: '' }, { ריק: null }], columns)).toEqual({
      matched: {},
      unmatched: ['ריק'],
    });
  });
});

describe('remapRows', () => {
  it('renames mapped fields, ignores unmapped and empty values, and joins duplicate targets', () => {
    expect(
      remapRows(
        [{ שם: 'דוד', שם_נוסף: 'כהן', טלפון: ' 0501234567 ', ריק: '' }],
        { שם: 'display', שם_נוסף: 'display', טלפון: 'phone' }
      )
    ).toEqual([{ display: 'דוד כהן', phone: '0501234567' }]);
  });
});
