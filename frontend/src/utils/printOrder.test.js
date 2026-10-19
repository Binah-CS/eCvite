import { orderLikeTable } from './printOrder';

const a = { hashCode: 'a', city: 'ירושלים' };
const b = { hashCode: 'b', city: 'אלעד' };
const c = { hashCode: 'c', city: 'בני ברק' };
const names = (list) => list.map((row) => row.hashCode);

test('rows come out in the table order (after sorting)', () => {
  expect(names(orderLikeTable([a, b, c], [b, c, a]))).toEqual(['b', 'c', 'a']);
});

test('selected rows follow the table order, not the order they were selected', () => {
  expect(names(orderLikeTable([a, b], [b, c, a]))).toEqual(['b', 'a']);
});

test('a row without hashCode is matched by id', () => {
  const fresh = { id: 7, city: 'חיפה' };
  expect(orderLikeTable([a, fresh], [fresh, a])).toEqual([fresh, a]);
});

test('rows missing from the table keep their order at the end', () => {
  const x = { hashCode: 'x' };
  const y = { hashCode: 'y' };
  expect(names(orderLikeTable([x, a, y], [a]))).toEqual(['a', 'x', 'y']);
});

test('no table order - the list stays as is', () => {
  expect(orderLikeTable([a, b], null)).toEqual([a, b]);
  expect(orderLikeTable([a, b], [])).toEqual([a, b]);
});
