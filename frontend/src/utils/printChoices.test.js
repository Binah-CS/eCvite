import { RETURN_CHOICE_KEYS, clampEnglishSalutation, resolveInitialChoices } from './printChoices';
import { DEFAULT_FONT_ID, DEFAULT_LETTER_SPACING } from '../fonts/fonts';
import { FONT_SCALE_DEFAULT } from './labelSheetLayout';
import { MAX_ENGLISH_SALUTATION_LENGTH } from './labelPrintSettings';

const sessionFrom = (values) => (key) => (key in values ? values[key] : null);

describe('initial print choices', () => {
  test('nothing saved anywhere - the defaults', () => {
    expect(resolveInitialChoices()).toEqual({
      fontType: DEFAULT_FONT_ID,
      englishFontType: '',
      printer: 'home',
      deliveryMethod: 'courier',
      fontScale: FONT_SCALE_DEFAULT,
      fontWeight: null,
      letterSpacing: DEFAULT_LETTER_SPACING,
      englishSalutation: '',
      emptyLineWhenNoAddress: true,
      greetingShow: true,
      greetingSeparateLine: true,
      greetingAlign: 'center',
    });
  });

  test('the type\'s own saved choice comes first', () => {
    const choices = resolveInitialChoices({
      primary: { fontType: 'heebo', fontScale: 130, printer: 'office' },
      fallback: { fontType: 'rubik', fontScale: 90, printer: 'home' },
    });
    expect(choices).toMatchObject({ fontType: 'heebo', fontScale: 130, printer: 'office' });
  });

  test('a type with nothing saved starts from the other type, key by key', () => {
    const choices = resolveInitialChoices({
      primary: { fontScale: 130 },
      fallback: { fontType: 'rubik', fontScale: 90, greetingShow: false, englishSalutation: 'Dear' },
    });
    expect(choices).toMatchObject({
      fontScale: 130, fontType: 'rubik', greetingShow: false, englishSalutation: 'Dear', printer: 'home',
    });
  });

  test('returning from the preview wins over both saved choices', () => {
    const choices = resolveInitialChoices({
      session: sessionFrom({ savedFontType: 'tahoma', savedFontScale: '115', savedGreetingShow: 'false', savedEnglishSalutation: '' }),
      primary: { fontType: 'heebo', fontScale: 130, englishSalutation: 'Dear' },
      fallback: { fontType: 'rubik' },
    });
    expect(choices).toMatchObject({ fontType: 'tahoma', fontScale: 115, greetingShow: false, englishSalutation: '' });
  });

  test('invalid values are skipped down the chain', () => {
    const choices = resolveInitialChoices({
      session: sessionFrom({ savedPrinter: 'printer1' }),
      primary: { printer: 'nope', fontType: 'not-a-font', greetingAlign: 'top', letterSpacing: 'huge' },
      fallback: { printer: 'office', fontType: 'heebo' },
    });
    expect(choices).toMatchObject({
      printer: 'office', fontType: 'heebo', greetingAlign: 'center', letterSpacing: DEFAULT_LETTER_SPACING,
    });
  });

  test('a weight that was never chosen stays null, so each type gets its own default', () => {
    expect(resolveInitialChoices({ primary: { fontWeight: null }, fallback: {} }).fontWeight).toBeNull();
    expect(resolveInitialChoices({ primary: {}, fallback: { fontWeight: 'regular' } }).fontWeight).toBe('regular');
  });

  test('a long salutation is cut to the maximum length', () => {
    const long = 'x'.repeat(MAX_ENGLISH_SALUTATION_LENGTH + 20);
    expect(resolveInitialChoices({ primary: { englishSalutation: long } }).englishSalutation)
      .toHaveLength(MAX_ENGLISH_SALUTATION_LENGTH);
    expect(clampEnglishSalutation(null)).toBe('');
  });

  test('a session that cannot be read does not throw', () => {
    const choices = resolveInitialChoices({ session: () => { throw new Error('blocked'); }, primary: { printer: 'office' } });
    expect(choices.printer).toBe('office');
  });

  test('every return key is listed for clearing', () => {
    expect(RETURN_CHOICE_KEYS).toEqual(expect.arrayContaining([
      'savedFontType', 'savedFontScale', 'savedFontWeight', 'savedLetterSpacing', 'savedEnglishSalutation', 'savedGreetingAlign',
    ]));
  });
});
