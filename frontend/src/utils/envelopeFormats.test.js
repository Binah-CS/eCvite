import {
  ENVELOPE_SIZES,
  CUSTOM_ENVELOPE_ID,
  DEFAULT_CUSTOM_ENVELOPE,
  createDefaultEnvelopeSettings,
  getCustomSizeError,
  createEmptySender,
  getDefaultFlapDepth,
  getSenderMode,
  hasSenderDetails,
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

  test.each([
    [{ widthMm: 110, heightMm: 80 }, null],
    [{ widthMm: 350, heightMm: 260 }, null],
    [{ widthMm: '184', heightMm: '133' }, null],
    [{ widthMm: 150, heightMm: 150 }, null],
    [{ widthMm: 109, heightMm: 80 }, 'tooSmall'],
    [{ widthMm: 110, heightMm: 79 }, 'tooSmall'],
    [{ widthMm: 351, heightMm: 200 }, 'tooLarge'],
    [{ widthMm: 300, heightMm: 261 }, 'tooLarge'],
    [{ widthMm: 133, heightMm: 184 }, 'swapped'],
    [{ widthMm: 260, heightMm: 350 }, 'swapped'],
    [{ widthMm: 80, heightMm: 100 }, 'portrait'],
    [{ widthMm: 100, heightMm: 400 }, 'portrait'],
    [{ widthMm: '', heightMm: 100 }, 'invalid'],
    [{ widthMm: -5, heightMm: 100 }, 'invalid'],
  ])('custom size %o: error %p', (customSize, error) => {
    expect(getCustomSizeError(customSize)).toBe(error);
    expect(resolveEnvelopeDimensions({ sizeId: CUSTOM_ENVELOPE_ID, customSize }) === null).toBe(error !== null);
  });

  test('the fixed sizes and the default custom size are inside the allowed range', () => {
    ENVELOPE_SIZES.forEach((size) => expect(getCustomSizeError(size)).toBeNull());
    expect(getCustomSizeError(DEFAULT_CUSTOM_ENVELOPE)).toBeNull();
  });

  test('swapping the measurements of a swapped envelope makes it valid', () => {
    const swapped = { widthMm: 133, heightMm: 184 };
    expect(getCustomSizeError(swapped)).toBe('swapped');
    expect(getCustomSizeError({ widthMm: swapped.heightMm, heightMm: swapped.widthMm })).toBeNull();
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

  test('house number, zip and country are optional', () => {
    expect(isSenderComplete(complete)).toBe(true);
    expect(isSenderComplete({ ...complete, houseNo: '', zip: '', country: '' })).toBe(true);
  });

  test.each(['name', 'street', 'city'])('%s is required', (field) => {
    expect(isSenderComplete({ ...complete, [field]: '   ' })).toBe(false);
  });

  test('the default settings print the recipient only, with a straight flap', () => {
    expect(createDefaultEnvelopeSettings()).toMatchObject({
      sizeId: 'a7',
      printSender: false,
      senderPlacement: 'openFlap',
      cornerSide: 'auto',
      flapDepthMm: 40,
      flapShape: 'straight',
      senderTypography: null,
    });
    expect(getSenderMode(createDefaultEnvelopeSettings())).toBe('none');
  });

  test('a sender with any detail counts as filled in', () => {
    expect(hasSenderDetails(createEmptySender())).toBe(false);
    expect(hasSenderDetails({ ...createEmptySender(), zip: ' ' })).toBe(false);
    expect(hasSenderDetails({ ...createEmptySender(), country: 'ישראל' })).toBe(true);
  });
});

describe('sender mode', () => {
  test('off prints no sender, on prints at the chosen placement', () => {
    expect(getSenderMode({ printSender: false, senderPlacement: 'frontCorner' })).toBe('none');
    expect(getSenderMode({ printSender: true, senderPlacement: 'frontCorner' })).toBe('frontCorner');
    expect(getSenderMode({ printSender: true, senderPlacement: 'openFlap' })).toBe('openFlap');
  });

  test('an unknown placement falls back to the flap', () => {
    expect(getSenderMode({ printSender: true, senderPlacement: 'nope' })).toBe('openFlap');
  });

  test('turning the sender off and on again keeps the corner', () => {
    const corner = { ...createDefaultEnvelopeSettings(), printSender: true, senderPlacement: 'frontCorner', cornerSide: 'left' };
    const off = { ...corner, printSender: false };
    const onAgain = { ...off, printSender: true };
    expect(getSenderMode(off)).toBe('none');
    expect(getSenderMode(onAgain)).toBe('frontCorner');
    expect(onAgain.cornerSide).toBe('left');
  });
});
