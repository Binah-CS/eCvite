import {
  DEFAULT_FONT_ID,
  FONTS,
  FONT_CATEGORIES,
  getAddressFontFamily,
  getFont,
  getFontScriptWarning,
  normalizeEnglishFontId,
  normalizeFontId,
  normalizeFontPair,
  getAddressTextStyle,
  getAddressLetterSpacing,
  getDefaultFontWeight,
  getLetterSpacingAvailability,
  isConnectedFont,
  normalizeLetterSpacing,
  resolveFontWeight,
} from './fonts';

describe('font weight', () => {
  test('envelopes default to bold and labels stay regular', () => {
    expect(getDefaultFontWeight('envelopes')).toBe('bold');
    expect(getDefaultFontWeight('labels')).toBe('regular');
    expect(getDefaultFontWeight(undefined)).toBe('regular');
  });

  test('without a choice the default of the print type is used', () => {
    expect(resolveFontWeight(null, 'envelopes')).toBe('bold');
    expect(resolveFontWeight(undefined, 'envelopes')).toBe('bold');
    expect(resolveFontWeight(null, 'labels')).toBe('regular');
  });

  test('a saved or chosen weight is kept, including regular on envelopes', () => {
    expect(resolveFontWeight('regular', 'envelopes')).toBe('regular');
    expect(resolveFontWeight('bold', 'labels')).toBe('bold');
  });

  test('an unknown value falls back to the default', () => {
    expect(resolveFontWeight('heavy', 'envelopes')).toBe('bold');
    expect(resolveFontWeight('', 'labels')).toBe('regular');
  });
});

describe('getAddressTextStyle', () => {
  test('prints in solid black without synthetic bold, and without spacing when no level is given (labels)', () => {
    expect(getAddressTextStyle()).toEqual({ color: '#000000', fontSynthesis: 'none' });
  });

  test('with a level, the spacing of the address language is added', () => {
    expect(getAddressTextStyle({ language: 'he', fontType: 'heebo', englishFontType: 'parisienne', letterSpacing: 'wider' }))
      .toEqual({ color: '#000000', fontSynthesis: 'none', letterSpacing: '0.08em' });
    expect(getAddressTextStyle({ language: 'en', fontType: 'heebo', englishFontType: 'parisienne', letterSpacing: 'wider' }))
      .toEqual({ color: '#000000', fontSynthesis: 'none', letterSpacing: 'normal' });
  });
});

describe('letter spacing', () => {
  test('only the connected handwriting fonts are marked, and the behavior comes from the field', () => {
    expect(FONTS.filter(isConnectedFont).map((font) => font.id)).toEqual(['parisienne', 'dancing-script']);
    // כתב יד עברי - האותיות לא מתחברות, ולכן הריווח חל עליו
    expect(isConnectedFont(getFont('gveret-levin'))).toBe(false);
  });

  test.each([['normal', 'normal'], ['wide', '0.04em'], ['wider', '0.08em']])(
    'level %s on a regular font is %s',
    (level, expected) => {
      expect(getAddressLetterSpacing('he', 'heebo', '', level)).toBe(expected);
      expect(getAddressLetterSpacing('en', 'heebo', '', level)).toBe(expected);
    },
  );

  test('an unknown or missing level means no spacing', () => {
    expect(getAddressLetterSpacing('he', 'heebo', '', 'huge')).toBe('normal');
    expect(getAddressLetterSpacing('he', 'heebo')).toBe('normal');
    expect(normalizeLetterSpacing(undefined)).toBe('normal');
    expect(normalizeLetterSpacing('wide')).toBe('wide');
  });

  // כל כתובת לפי הכתב של השפה שלה: כתב מחובר רק לאנגלית לא מבטל ריווח בעברית
  test('only the connected English font: Hebrew addresses get spacing and English ones do not', () => {
    expect(getAddressLetterSpacing('he', 'heebo', 'dancing-script', 'wide')).toBe('0.04em');
    expect(getAddressLetterSpacing('en', 'heebo', 'dancing-script', 'wide')).toBe('normal');
    expect(getLetterSpacingAvailability('heebo', 'dancing-script')).toEqual({ he: true, en: false });
  });

  test('without an English font, English addresses follow the Hebrew font', () => {
    expect(getAddressLetterSpacing('en', 'gveret-levin', '', 'wide')).toBe('0.04em');
    expect(getLetterSpacingAvailability('heebo', '')).toEqual({ he: true, en: true });
  });

  // היום אין כתב עברי מחובר, ולכן זה קורה רק כשכל הכתבים שנבחרו הם כתבי יד לטיניים מחוברים
  test('when every chosen font is connected, no language gets spacing', () => {
    expect(getLetterSpacingAvailability('parisienne', 'dancing-script')).toEqual({ he: false, en: false });
    expect(getAddressLetterSpacing('he', 'parisienne', 'dancing-script', 'wider')).toBe('normal');
  });
});

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

  test('a font without English letters is not a valid English font', () => {
    expect(normalizeEnglishFontId('gveret-levin')).toBe('');
    expect(normalizeEnglishFontId('David, serif')).toBe('david');
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

  test('an old English-only primary font is moved to the English field, so Hebrew has a font', () => {
    expect(getFontScriptWarning('parisienne')).toBeNull();
    expect(getFontScriptWarning('parisienne', 'dancing-script')).toBeNull();
  });

  test('a combination that covers both scripts needs no warning', () => {
    expect(getFontScriptWarning('gveret-levin', 'parisienne')).toBeNull();
    expect(getFontScriptWarning('parisienne', 'heebo')).toBeNull();
  });

  test('only languages that actually have addresses are checked', () => {
    expect(getFontScriptWarning('gveret-levin', '', ['he'])).toBeNull();
    expect(getFontScriptWarning('gveret-levin', '', ['he', 'en'])).toMatch('אנגלית');
    expect(getFontScriptWarning('noto-rashi-hebrew', 'parisienne', ['he', 'en'])).toBeNull();
    expect(getFontScriptWarning('gveret-levin', '', [])).toBeNull();
  });
});

describe('normalizeFontPair', () => {
  test('a valid Hebrew font and English font stay as they are', () => {
    expect(normalizeFontPair('gveret-levin', 'parisienne')).toEqual({ fontType: 'gveret-levin', englishFontType: 'parisienne' });
    expect(normalizeFontPair('heebo', '')).toEqual({ fontType: 'heebo', englishFontType: '' });
  });

  test('a saved primary font without Hebrew moves to an empty English field', () => {
    expect(normalizeFontPair('parisienne', '')).toEqual({ fontType: DEFAULT_FONT_ID, englishFontType: 'parisienne' });
    expect(normalizeFontPair('dancing-script', undefined)).toEqual({ fontType: DEFAULT_FONT_ID, englishFontType: 'dancing-script' });
  });

  test('an English font that was already chosen is kept', () => {
    expect(normalizeFontPair('parisienne', 'heebo')).toEqual({ fontType: DEFAULT_FONT_ID, englishFontType: 'heebo' });
  });

  test('old saved values and unknown values', () => {
    expect(normalizeFontPair('David, serif', '')).toEqual({ fontType: 'david', englishFontType: '' });
    expect(normalizeFontPair('"Courier New", monospace', 'nope')).toEqual({ fontType: 'courier-new', englishFontType: '' });
    expect(normalizeFontPair(undefined, 'gveret-levin')).toEqual({ fontType: DEFAULT_FONT_ID, englishFontType: '' });
  });
});
