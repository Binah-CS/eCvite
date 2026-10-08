import {
  REAL_LABEL_SIZES,
  REAL_PAGE_CONTENT_WIDTH,
  getColumns,
  getRealColumns,
  getScaledLabelSizes,
} from './labelSheetLayout';

describe('label sheet layout', () => {
  it('calculates the number of labels that fit in a row and never returns zero', () => {
    expect(getColumns(210, 70, 0)).toBe(3);
    expect(getColumns(20, 70, 0)).toBe(1);
    expect(getColumns(220, 70, 5)).toBe(3);
  });

  it('uses the standard label as the fallback size', () => {
    expect(getRealColumns('standard')).toBe(3);
    expect(getRealColumns('unknown-size')).toBe(getRealColumns('standard'));
  });

  it('scales every label dimension by the same ratio', () => {
    const targetWidth = REAL_PAGE_CONTENT_WIDTH / 2;
    const { scale, gap, sizes } = getScaledLabelSizes(targetWidth);

    expect(scale).toBe(0.5);
    expect(gap).toBe(0);
    expect(sizes.standard).toEqual({
      width: REAL_LABEL_SIZES.standard.width / 2,
      height: REAL_LABEL_SIZES.standard.height / 2,
    });
  });
});
