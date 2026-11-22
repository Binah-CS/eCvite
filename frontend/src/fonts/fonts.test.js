import {
  DEFAULT_FONT_ID,
  FONTS,
  FONT_CATEGORIES,
  getAddressFontFamily,
  getFont,
  getFontScriptWarning,
  normalizeEnglishFontId,
  normalizeFontId,
} from './fonts';

describe('the font list', () => {
  test('every font has a unique id, a known category and at least one script', () => {
    const ids = FONTS.map((font) => font.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = FONT_CATEGORIES.map((category) => category.id);
    FONTS.forEach((font) => {
      expect(categories).toContain(font.category);
      expect(font.scripts.length).toBeGreaterThan(0);
      font.scripts.forEach((script) => expect(['he', 'en']).toContain(script));
      expect(font.cssFamily).toBe(`${font.family}, ${font.fallback}`);
    });
  });

  test('the default font exists and is offered in the menu', () => {
    expect(getFont(DEFAULT_FONT_ID)?.hidden).toBeFalsy();
  });
});

describe('normalizeFontId', () => {
  test('a known id stays as it is', () => {
    expect(normalizeFontId('heebo')).toBe('heebo');
    expect(normalizeFontId('gveret-levin')).toBe('gveret-levin');
  });

  test.each([
    ['Arial, sans-serif', 'arial'],
    ['Tahoma, sans-serif', 'tahoma'],
    ['David, serif', 'david'],
    ['"Courier New", monospace', 'courier-new'],
  ])('the old saved value %s becomes %s', (legacy, id) => {
    expect(normalizeFontId(legacy)).toBe(id);
  });

  test('old David and Courier New stay available but are hidden from the menu', () => {
    expect(getFont('david').hidden).toBe(true);
    expect(getFont('courier-new').hidden).toBe(true);
  });

  test.each([['Comic Sans MS'], [''], [undefined], [null], [42]])('an unknown value (%p) becomes the default', (value) => {
    expect(normalizeFontId(value)).toBe(DEFAULT_FONT_ID);
  });

  test('the fallback can be overridden', () => {
    expect(normalizeFontId('nope', null)).toBeNull();
    expect(normalizeEnglishFontId('')).toBe('');
    expect(normalizeEnglishFontId('nope')).toBe('');
    expect(normalizeEnglishFontId('parisienne')).toBe('parisienne');
  });
});

describe('getAddressFontFamily', () => {
  test('without an English font, both languages use the primary font', () => {
    expect(getAddressFontFamily('he', 'heebo')).toBe('"Heebo", sans-serif');
    expect(getAddressFontFamily('en', 'heebo', '')).toBe('"Heebo", sans-serif');
  });

  test('an English address: English font first, then the primary', () => {
    expect(getAddressFontFamily('en', 'gveret-levin', 'parisienne'))
      .toBe('"Parisienne", "Gveret Levin", serif');
  });

  test('a Hebrew address: the primary first, then the English font', () => {
    expect(getAddressFontFamily('he', 'gveret-levin', 'parisienne'))
      .toBe('"Gveret Levin", "Parisienne", sans-serif');
  });

  test('the same font twice is just that font', () => {
    expect(getAddressFontFamily('en', 'heebo', 'heebo')).toBe('"Heebo", sans-serif');
  });

  test('old saved values work too', () => {
    expect(getAddressFontFamily('he', 'David, serif')).toBe('David, serif');
  });
});

describe('getFontScriptWarning', () => {
  test('a font with both scripts needs no warning', () => {
    expect(getFontScriptWarning('heebo')).toBeNull();
    expect(getFontScriptWarning('courier-new')).toBeNull();
  });

  test('Hebrew-only without an English font warns about English', () => {
    expect(getFontScriptWarning('gveret-levin')).toMatch('אנגלית');
  });

  test('English-only with an English-only English font warns about Hebrew', () => {
    expect(getFontScriptWarning('parisienne', 'dancing-script')).toMatch('עברית');
  });

  test('a combination that covers both scripts needs no warning', () => {
    expect(getFontScriptWarning('gveret-levin', 'parisienne')).toBeNull();
    expect(getFontScriptWarning('parisienne', 'heebo')).toBeNull();
  });
});
