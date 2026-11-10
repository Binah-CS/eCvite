import {
  ENVELOPE_SIZES,
  CUSTOM_ENVELOPE_ID,
  createDefaultEnvelopeSettings,
  createEmptySender,
  getDefaultFlapDepth,
  isKnownEnvelopeSize,
  isSenderComplete,
  isValidFlapDepth,
  resolveEnvelopeDimensions,
} from './envelopeFormats';

describe('envelope sizes', () => {
  test('the fixed sizes have the agreed measurements and flap depths', () => {
    expect(ENVELOPE_SIZES).toEqual([
      expect.objectContaining({ id: 'a7', label: 'סטנדרטית', widthMm: 184, heightMm: 133, defaultFlapDepthMm: 40 }),
      expect.objectContaining({ id: 'c6', label: 'קטנה', widthMm: 162, heightMm: 114, defaultFlapDepthMm: 30 }),
    ]);
  });

  test('a fixed size resolves to its own measurements and ignores the custom ones', () => {
    expect(resolveEnvelopeDimensions({ sizeId: 'c6', customSize: { widthMm: 1, heightMm: 1 } }))
      .toEqual({ widthMm: 162, heightMm: 114 });
  });

  test('a custom size uses the typed measurements, also when they are strings', () => {
    expect(resolveEnvelopeDimensions({ sizeId: CUSTOM_ENVELOPE_ID, customSize: { widthMm: '200', heightMm: 100 } }))
      .toEqual({ widthMm: 200, heightMm: 100 });
  });

  test.each([
    [{ widthMm: '', heightMm: 100 }],
    [{ widthMm: 0, heightMm: 100 }],
    [{ widthMm: -5, heightMm: 100 }],
    [{ widthMm: 'abc', heightMm: 100 }],
    [undefined],
  ])('invalid custom measurements resolve to null', (customSize) => {
    expect(resolveEnvelopeDimensions({ sizeId: CUSTOM_ENVELOPE_ID, customSize })).toBeNull();
  });

  test('an unknown size resolves to null', () => {
    expect(isKnownEnvelopeSize('b5')).toBe(false);
    expect(resolveEnvelopeDimensions({ sizeId: 'b5' })).toBeNull();
  });

  test('each size has its own default flap depth', () => {
    expect(getDefaultFlapDepth('a7')).toBe(40);
    expect(getDefaultFlapDepth('c6')).toBe(30);
    expect(getDefaultFlapDepth(CUSTOM_ENVELOPE_ID)).toBeGreaterThan(0);
  });
});

describe('flap depth', () => {
  test.each([[40, true], ['40', true], [133, true], [134, false], [0, false], ['', false]])(
    'depth %s on a 133mm envelope is valid: %s',
    (depth, expected) => {
      expect(isValidFlapDepth(depth, 133)).toBe(expected);
    },
  );
});

describe('senders', () => {
  const complete = { ...createEmptySender(), name: 'כהן', street: 'הרצל', houseNo: '12', city: 'ירושלים' };

  test('zip and country are optional', () => {
    expect(isSenderComplete(complete)).toBe(true);
  });

  test.each(['name', 'street', 'houseNo', 'city'])('%s is required', (field) => {
    expect(isSenderComplete({ ...complete, [field]: '   ' })).toBe(false);
  });

  test('the default settings print the recipient only, with a straight flap', () => {
    expect(createDefaultEnvelopeSettings()).toMatchObject({
      sizeId: 'a7', senderMode: 'none', flapDepthMm: 40, flapShape: 'straight', senderTypography: null,
    });
  });
});
