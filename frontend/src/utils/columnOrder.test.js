import { moveColumn, resolveColumnOrder } from './columnOrder';

const fieldDefs = [
  { technicalName: 'city', defaultOrder: 3 },
  { technicalName: 'man', defaultOrder: 1 },
  { technicalName: 'street', defaultOrder: 2 },
];

describe('resolveColumnOrder', () => {
  test('no saved order - the default order from the DB', () => {
    expect(resolveColumnOrder(undefined, fieldDefs)).toEqual(['man', 'street', 'city']);
  });

  test('the saved order of the user wins', () => {
    expect(resolveColumnOrder(['city', 'man', 'street'], fieldDefs)).toEqual(['city', 'man', 'street']);
  });

  test('a column that no longer exists is dropped, and a new column is added at the end', () => {
    expect(resolveColumnOrder(['city', 'gone', 'man'], fieldDefs)).toEqual(['city', 'man', 'street']);
  });
});

describe('moveColumn', () => {
  const order = ['a', 'b', 'c', 'd'];

  test('dragging down puts the column after the target', () => {
    expect(moveColumn(order, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  test('dragging up puts the column before the target', () => {
    expect(moveColumn(order, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  test('dropping on itself or on an unknown column changes nothing', () => {
    expect(moveColumn(order, 'b', 'b')).toBe(order);
    expect(moveColumn(order, 'b', 'x')).toBe(order);
  });
});
