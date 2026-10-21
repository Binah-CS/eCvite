import {
  REAL_LABEL_SIZES,
  LABEL_FONT_BASE_PX,
  LABEL_LINE_HEIGHT,
  FONT_SCALE_MIN,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_STEP,
  getMaxFontScale,
  clampFontScale,
} from './labelSheetLayout';

// גובה התוכן הצפוי (שם + 3 שורות) בגודל כתב נתון, כולל ריפוד ומרווח מתחת לשם
function contentHeight(sizeKey, scale) {
  const base = LABEL_FONT_BASE_PX[sizeKey];
  return LABEL_LINE_HEIGHT * (base.name + 3 * base.line) * (scale / 100) + 2 * 4 + 2;
}

describe('getMaxFontScale', () => {
  test.each(['standard', 'large'])('%s: the maximum still fits in the label height', (sizeKey) => {
    expect(contentHeight(sizeKey, getMaxFontScale(sizeKey))).toBeLessThanOrEqual(REAL_LABEL_SIZES[sizeKey].height);
  });

  test.each(['standard', 'large'])('%s: today\'s size (100%%) is always allowed', (sizeKey) => {
    expect(getMaxFontScale(sizeKey)).toBeGreaterThanOrEqual(FONT_SCALE_DEFAULT);
  });

  // בפיקסלים ולא באחוזים - האחוז הוא יחסית לכתב הבסיסי של כל גודל, והבסיס בגדולה גדול בהרבה
  test('the large label allows a bigger font than the standard one', () => {
    const maxNamePx = (sizeKey) => LABEL_FONT_BASE_PX[sizeKey].name * getMaxFontScale(sizeKey) / 100;
    expect(maxNamePx('large')).toBeGreaterThan(maxNamePx('standard'));
  });
});

describe('clampFontScale', () => {
  test('a size above the maximum is lowered to the maximum of that label', () => {
    expect(clampFontScale(500, 'standard')).toBe(getMaxFontScale('standard'));
  });

  test('switching to a smaller label lowers a size that no longer fits', () => {
    const tooBigForStandard = getMaxFontScale('standard') + FONT_SCALE_STEP;
    expect(clampFontScale(tooBigForStandard, 'large')).toBe(Math.min(tooBigForStandard, getMaxFontScale('large')));
    expect(clampFontScale(tooBigForStandard, 'standard')).toBe(getMaxFontScale('standard'));
  });

  test('below the minimum is raised to the minimum; missing values fall back to 100', () => {
    expect(clampFontScale(10, 'standard')).toBe(FONT_SCALE_MIN);
    expect(clampFontScale(undefined, 'standard')).toBe(FONT_SCALE_DEFAULT);
    expect(clampFontScale('abc', 'standard')).toBe(FONT_SCALE_DEFAULT);
  });
});
