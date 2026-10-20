import {
  DEFAULT_CUSTOM_LABEL_FORMAT,
  getCustomLabelLayout,
  isValidCustomLabelFormat,
  normalizeCustomLabelFormat,
} from './labelFormats';

describe('custom label formats', () => {
  test('the default measurements resolve to a three-column, ten-row A4 sheet', () => {
    const layout = normalizeCustomLabelFormat(DEFAULT_CUSTOM_LABEL_FORMAT);

    expect(layout).toMatchObject({ columns: 3, rows: 10 });
    expect(isValidCustomLabelFormat(DEFAULT_CUSTOM_LABEL_FORMAT)).toBe(true);
  });

  test('label positions account for margins and gaps', () => {
    const layout = normalizeCustomLabelFormat({
      ...DEFAULT_CUSTOM_LABEL_FORMAT,
      labelWidthMm: 50,
      labelHeightMm: 40,
      leftMarginMm: 5,
      rightMarginMm: 5,
      topMarginMm: 8,
      bottomMarginMm: 9,
      horizontalGapMm: 2,
      verticalGapMm: 3,
    });

    expect(layout).toMatchObject({ columns: 3, rows: 6 });
  });

  test.each([
    [{ ...DEFAULT_CUSTOM_LABEL_FORMAT, labelWidthMm: 0 }],
    [{ ...DEFAULT_CUSTOM_LABEL_FORMAT, pageWidthMm: 50 }],
    [{ ...DEFAULT_CUSTOM_LABEL_FORMAT, leftMarginMm: -1 }],
    [{ ...DEFAULT_CUSTOM_LABEL_FORMAT, horizontalGapMm: Number.NaN }],
    [null],
  ])('rejects invalid measurements', (format) => {
    expect(isValidCustomLabelFormat(format)).toBe(false);
    expect(getCustomLabelLayout(format)).toBeNull();
  });
});
