import {
  CORNER_GAP_MM,
  CORNER_MIN_SENDER_WIDTH_MM,
  CORNER_STAMP_MIN_MM,
  RECIPIENT_MAX_NAME_PX,
  RECIPIENT_MIN_LINE_PX,
  REFERENCE_RECIPIENT_LINES,
  SENDER_MIN_LINE_PX,
  SENDER_MODES,
  buildEnvelopeLayout,
  estimateRecipientHeightMm,
  estimateSenderHeightMm,
  getCornerBottomGap,
  getEffectiveEnvelopeFontScale,
  getEnvelopeFontScaleRange,
  getEnvelopeMargin,
  getSenderTypographyLimit,
  isEnvelopeSettingsReady,
  normalizeEnvelopeFontScale,
  resolveCornerSide,
  resolveSenderTypography,
} from './envelopeLayout';
import { createDefaultEnvelopeSettings, createEmptySender } from './envelopeFormats';
import { countRecipientLines } from '../components/EnvelopeSheet';

const textStyle = { fontType: 'heebo', englishFontType: 'dancing-script', fontScale: 100, fontWeight: 'regular' };
const sender = { ...createEmptySender(), name: 'כהן', street: 'הרצל', houseNo: '12', city: 'ירושלים' };
const fullSender = { ...sender, zip: '9100001', country: 'ישראל' };
const settings = (overrides = {}) => ({ ...createDefaultEnvelopeSettings(), ...overrides });
const openFlap = (overrides = {}) => settings({ printSender: true, senderPlacement: 'openFlap', senders: [sender], ...overrides });
const frontCorner = (overrides = {}) => settings({ printSender: true, senderPlacement: 'frontCorner', senders: [sender], ...overrides });
const custom = (widthMm, heightMm) => ({ sizeId: 'custom', customSize: { widthMm, heightMm } });
const blockOf = (surface, role) => surface.blocks.find((block) => block.role === role);

// פרופילי שורות של נמען: ההנחה (שם + 3), נמען עברי רגיל עם "לכבוד" בשורה נפרדת ובלי ארץ,
// והמקרה הגרוע: "לכבוד" או פנייה באנגלית, שם, כתובת, עיר, ארץ ו-7 עמודות נוספות
const LINES = {
  reference: REFERENCE_RECIPIENT_LINES,
  hebrewTypical: { nameLines: 2, detailLines: 2 },
  worst: { nameLines: 2, detailLines: 10 },
};

// איפה הטקסט של הנמען לפי הערכת הגובה: ממורכז במלבן, או צמוד לראשו
const recipientContent = (layout, lines = REFERENCE_RECIPIENT_LINES) => {
  const block = blockOf(layout.passes[0], 'recipient');
  const height = estimateRecipientHeightMm(layout.typography.recipient, lines);
  const top = block.verticalAlign === 'top' ? block.rect.y : block.rect.y + (block.rect.height - height) / 2;
  return { top, bottom: top + height };
};
const toPt = (px) => px * 0.75;
const FLAP_FACTOR = SENDER_MODES.openFlap.senderFontFactor;
const CORNER_FACTOR = SENDER_MODES.frontCorner.senderFontFactor;
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('recipient only', () => {
  test('one page in the envelope size, with the recipient in the middle of it', () => {
    const { passes, finishedViews } = buildEnvelopeLayout(settings(), textStyle);

    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ pageWidthMm: 184, pageHeightMm: 133 });
    const { rect, rotationDeg } = blockOf(passes[0], 'recipient');
    expect(rotationDeg).toBe(0);
    expect(rect.x).toBeCloseTo(184 - rect.x - rect.width);
    expect(rect.y).toBeCloseTo(133 - rect.y - rect.height);
    expect(finishedViews).toBeNull();
  });

  test('margins grow with the envelope but never drop under the printer limit', () => {
    expect(getEnvelopeMargin({ widthMm: 184, heightMm: 133 })).toBeCloseTo(6.65);
    expect(getEnvelopeMargin({ widthMm: 110, heightMm: 80 })).toBe(5);
  });
});

describe('open flap', () => {
  test.each([
    ['a7', 184, 133 + 40],
    ['c6', 162, 114 + 30],
  ])('%s: the page is width x (height + flap depth)', (sizeId, width, height) => {
    const flapDepthMm = sizeId === 'a7' ? 40 : 30;
    const [pass] = buildEnvelopeLayout(openFlap({ sizeId, flapDepthMm }), textStyle).passes;
    expect(pass).toMatchObject({ pageWidthMm: width, pageHeightMm: height });
  });

  test('the recipient stays upright on the front, below the flap', () => {
    const [pass] = buildEnvelopeLayout(openFlap(), textStyle).passes;
    const recipient = blockOf(pass, 'recipient');
    expect(recipient.rotationDeg).toBe(0);
    expect(recipient.rect.y).toBeGreaterThanOrEqual(40);
  });

  test('the sender block is rotated as one unit and stays on the flap', () => {
    const [pass] = buildEnvelopeLayout(openFlap(), textStyle).passes;
    const senders = blockOf(pass, 'senders');
    expect(senders.rotationDeg).toBe(180);
    expect(senders.rect.y + senders.rect.height).toBeLessThanOrEqual(40);
  });

  test('a flap depth string from the input field is treated as a number', () => {
    const [pass] = buildEnvelopeLayout(openFlap({ flapDepthMm: '50' }), textStyle).passes;
    expect(pass.pageHeightMm).toBe(133 + 50);
  });

  test('on the closed envelope the sender is upright', () => {
    const { finishedViews } = buildEnvelopeLayout(openFlap(), textStyle);
    expect(blockOf(finishedViews.back, 'senders').rotationDeg).toBe(0);
    expect(finishedViews.front).toMatchObject({ pageWidthMm: 184, pageHeightMm: 133 });
  });

  test('text near the fold stays near the top of the closed back', () => {
    const { passes, finishedViews } = buildEnvelopeLayout(openFlap({ flapShape: 'triangular' }), textStyle);
    const open = blockOf(passes[0], 'senders').rect;
    const closed = blockOf(finishedViews.back, 'senders').rect;
    expect(40 - (open.y + open.height)).toBeCloseTo(closed.y);
  });

  test('with two senders the first is on the right of the closed envelope', () => {
    const { passes, finishedViews } = buildEnvelopeLayout(openFlap({ senders: [sender, sender] }), textStyle);
    const items = (block) => Object.fromEntries(block.items.map((item) => [item.senderIndex, item.rect]));

    const closed = items(blockOf(finishedViews.back, 'senders'));
    expect(closed[0].x).toBeGreaterThan(closed[1].x);

    // אותם מיקומים במיכל המסובב ב-180°: בפריסה הפתוחה הראשון יוצא משמאל
    const openBlock = blockOf(passes[0], 'senders');
    const openX = (rect) => openBlock.rect.width - rect.x - rect.width;
    const open = items(openBlock);
    expect(openX(open[0])).toBeLessThan(openX(open[1]));
  });

  test('two senders do not overlap and stay inside the block', () => {
    const [pass] = buildEnvelopeLayout(openFlap({ senders: [sender, sender] }), textStyle).passes;
    const block = blockOf(pass, 'senders');
    const [first, second] = block.items.map((item) => item.rect);
    expect(second.x + second.width).toBeLessThanOrEqual(first.x);
    expect(first.x + first.width).toBeCloseTo(block.rect.width);
  });

  test('a triangular flap leaves less width, and the text hugs the fold', () => {
    const straight = blockOf(buildEnvelopeLayout(openFlap(), textStyle).passes[0], 'senders').rect;
    const triangular = blockOf(
      buildEnvelopeLayout(openFlap({ flapShape: 'triangular' }), textStyle).passes[0],
      'senders',
    ).rect;
    expect(triangular.width).toBeLessThan(straight.width);
    expect(triangular.x).toBeCloseTo(184 - triangular.x - triangular.width);
    expect(40 - (triangular.y + triangular.height)).toBeCloseTo(3);
  });

  test('the fold line is a dashed guide at the flap depth', () => {
    const [pass] = buildEnvelopeLayout(openFlap(), textStyle).passes;
    expect(pass.guides.find((guide) => guide.dashed).points).toEqual([[0, 40], [184, 40]]);
  });
});

describe('invalid settings', () => {
  test('no layout for broken custom measurements', () => {
    expect(buildEnvelopeLayout(settings(custom('', 100)), textStyle)).toBeNull();
  });

  test.each([
    ['smaller than the minimum', 100, 80],
    ['a portrait envelope', 80, 120],
    ['larger than the maximum', 351, 200],
  ])('no layout, and printing is blocked, for an envelope %s', (_, widthMm, heightMm) => {
    expect(buildEnvelopeLayout(settings(custom(widthMm, heightMm)), textStyle)).toBeNull();
    expect(isEnvelopeSettingsReady(settings(custom(widthMm, heightMm)))).toBe(false);
  });

  test('no layout for a flap deeper than the envelope', () => {
    expect(buildEnvelopeLayout(openFlap({ flapDepthMm: 200 }), textStyle)).toBeNull();
  });

  test('an unknown placement falls back to the flap', () => {
    expect(buildEnvelopeLayout(openFlap({ senderPlacement: 'nope' }), textStyle).senderMode).toBe('openFlap');
  });

  test('saved senders are not printed while printing a sender is off', () => {
    const layout = buildEnvelopeLayout(settings({ printSender: false, senderPlacement: 'frontCorner', senders: [sender, sender] }), textStyle);
    expect(layout.senderMode).toBe('none');
    expect(layout.passes[0].blocks.map((block) => block.role)).toEqual(['recipient']);
    expect(layout.omittedSenderCount).toBe(0);
  });

  test('a flap value that is not valid does not matter when no sender is printed', () => {
    expect(buildEnvelopeLayout(settings({ flapDepthMm: '' }), textStyle)).not.toBeNull();
    expect(isEnvelopeSettingsReady(settings({ flapDepthMm: '' }))).toBe(true);
  });

  test('printing a sender needs complete sender details', () => {
    expect(isEnvelopeSettingsReady(openFlap())).toBe(true);
    expect(isEnvelopeSettingsReady(openFlap({ senders: [createEmptySender()] }))).toBe(false);
    expect(isEnvelopeSettingsReady(openFlap({ senders: [sender, createEmptySender()] }))).toBe(false);
    expect(isEnvelopeSettingsReady(openFlap({ senders: [] }))).toBe(false);
    expect(isEnvelopeSettingsReady(openFlap({ senders: [sender, sender, sender] }))).toBe(false);
  });

  test('the sender modes are the agreed ones', () => {
    expect(Object.keys(SENDER_MODES)).toEqual(['none', 'openFlap', 'frontCorner']);
  });
});

describe('the font size limit', () => {
  const modes = {
    none: (size) => settings(size),
    openFlap: (size) => openFlap(size),
    frontCorner: (size) => frontCorner(size),
  };

  // הערכים מחושבים מראש: המינימום והמקסימום לפי הגבולות ב-pt (תלויים רק בגובה), והמקסימום
  // יורד כשהתוכן של החזית לא נכנס - בלשונית ובלי שולח רק הנמען, ובפינה גם השולח
  test.each([
    ['a7', { sizeId: 'a7' }, { none: [125, 125, 125], openFlap: [125, 125, 125], frontCorner: [125, 125, 125] }, 85],
    ['c6', { sizeId: 'c6' }, { none: [150, 150, 150], openFlap: [150, 150, 150], frontCorner: [150, 150, 125] }, 100],
    ['110x80', custom(110, 80), { none: [200, 200, 175], openFlap: [200, 200, 175], frontCorner: [200, 200, 140] }, 140],
    ['350x260', custom(350, 260), { none: [90, 90, 90], openFlap: [90, 90, 90], frontCorner: [90, 90, 90] }, 70],
  ])('%s: the range for each mode and recipient lines', (_, size, expectedMax, expectedMin) => {
    Object.entries(modes).forEach(([mode, build]) => {
      const ranges = [LINES.reference, LINES.hebrewTypical, LINES.worst]
        .map((lines) => getEnvelopeFontScaleRange(build(size), lines));
      expect({ mode, max: ranges.map((range) => range.max) }).toEqual({ mode, max: expectedMax[mode] });
      expect(ranges.every((range) => range.min === expectedMin)).toBe(true);
    });
  });

  // הגבולות של הדרישה: נמען לפחות 10pt בשורות ועד 18pt בשם, שולח לפחות 8pt - בכל גודל שנבחר
  test.each([['a7', { sizeId: 'a7' }], ['c6', { sizeId: 'c6' }], ['110x80', custom(110, 80)], ['350x260', custom(350, 260)]])(
    '%s: at any chosen size the recipient stays between 10pt and 18pt and the sender is at least 8pt',
    (_, size) => {
      [1, 70, 100, 150, 5000].forEach((fontScale) => {
        [openFlap(size), frontCorner(size)].forEach((envelope) => {
          const { recipient, sender: senderTypography } = buildEnvelopeLayout(envelope, { ...textStyle, fontScale }).typography;
          expect(recipient.linePx).toBeGreaterThanOrEqual(RECIPIENT_MIN_LINE_PX - 1e-9);
          expect(recipient.namePx).toBeLessThanOrEqual(RECIPIENT_MAX_NAME_PX + 1e-9);
          expect(senderTypography.linePx).toBeGreaterThanOrEqual(SENDER_MIN_LINE_PX - 1e-9);
        });
      });
    },
  );

  test('the standard envelope at 100%: recipient 14pt/12pt, sender 90% on the flap and 80% in the corner', () => {
    const flap = buildEnvelopeLayout(openFlap(), textStyle).typography;
    const corner = buildEnvelopeLayout(frontCorner(), textStyle).typography;
    expect(toPt(flap.recipient.namePx)).toBeCloseTo(14);
    expect(toPt(flap.recipient.linePx)).toBeCloseTo(12);
    expect(toPt(flap.sender.namePx)).toBeCloseTo(14 * FLAP_FACTOR);
    expect(toPt(flap.sender.linePx)).toBeCloseTo(12 * FLAP_FACTOR);
    expect(toPt(corner.sender.namePx)).toBeCloseTo(14 * CORNER_FACTOR);
    expect(toPt(corner.sender.linePx)).toBeCloseTo(12 * CORNER_FACTOR);
  });

  // כתובת רגילה (עד שם + 4 שורות) נכנסת בגודל המינימלי בכל המידות, גם עם שולח מלא בפינה
  test.each([[110, 80], [350, 80], [260, 260], [350, 260]])(
    '%sx%smm at the minimum font: a regular address fits in height with a sender in the corner',
    (widthMm, heightMm) => {
      const dimensions = { widthMm, heightMm };
      [LINES.reference, LINES.hebrewTypical].forEach((lines) => {
        const corner = buildEnvelopeLayout(
          frontCorner({ ...custom(widthMm, heightMm), senders: [fullSender] }),
          { ...textStyle, fontScale: 1 },
          { recipientLines: lines, runRecipientLines: lines },
        );
        const senders = blockOf(corner.passes[0], 'senders').rect;
        const content = recipientContent(corner, lines);
        expect(content.top).toBeGreaterThanOrEqual(senders.y + senders.height + CORNER_GAP_MM - 1e-9);
        expect(content.bottom).toBeLessThanOrEqual(heightMm - getCornerBottomGap(dimensions) + 1e-9);
      });
    },
  );

  test('the maximum goes down to what fits, and stops at the minimum', () => {
    expect(getEnvelopeFontScaleRange(settings(), { nameLines: 2, detailLines: 20 })).toEqual({ min: 85, max: 100 });
    const layout = buildEnvelopeLayout(settings(), { ...textStyle, fontScale: 200 }, { runRecipientLines: { nameLines: 2, detailLines: 20 } });
    expect(estimateRecipientHeightMm(layout.typography.recipient, { nameLines: 2, detailLines: 20 }))
      .toBeLessThanOrEqual(133 - 2 * getEnvelopeMargin({ widthMm: 184, heightMm: 133 }));

    expect(getEnvelopeFontScaleRange(settings(), { nameLines: 2, detailLines: 40 })).toEqual({ min: 85, max: 85 });
  });

  // מעטפה נמוכה עם הרבה שורות: לא מקטינים מתחת למינימום. התוכן גולש, והגלישה נמדדת ב-DOM
  // ומקבלת אזהרה (measureEnvelopeOverflow)
  test('when even the minimum does not fit, the font stays at the minimum and the recipient overflows', () => {
    const small = frontCorner({ ...custom(110, 80), senders: [fullSender] });
    expect(getEnvelopeFontScaleRange(small, LINES.worst)).toEqual({ min: 140, max: 140 });
    const layout = buildEnvelopeLayout(small, { ...textStyle, fontScale: 200 }, { recipientLines: LINES.worst, runRecipientLines: LINES.worst });
    expect(layout.typography.recipient.linePx).toBeGreaterThanOrEqual(RECIPIENT_MIN_LINE_PX - 1e-9);
    expect(recipientContent(layout, LINES.worst).bottom).toBeGreaterThan(80 - getCornerBottomGap({ widthMm: 110, heightMm: 80 }));
  });
});

// הלשונית והחזית הם שטחים נפרדים: עומק הלשונית מגביל רק את כתב השולח, והנמען נשאר בגודל
// שנבחר (עד התקרה של החזית)
describe('the sender on a shallow flap', () => {
  const atMax = { ...textStyle, fontScale: 200 };
  const flapSpace = (flapDepthMm) => flapDepthMm - 3 - getEnvelopeMargin({ widthMm: 184, heightMm: 133 });
  const recipientAlone = buildEnvelopeLayout(settings(), atMax).typography.recipient;

  test('a 30mm flap leaves the recipient at its maximum, and only the sender gets smaller to fill the flap', () => {
    const shallow = openFlap({ flapDepthMm: 30 });
    expect(getEnvelopeFontScaleRange(shallow).max).toBe(125);
    const { recipient, sender: shallowSender } = buildEnvelopeLayout(shallow, atMax).typography;
    expect(recipient).toEqual(recipientAlone);

    const deepSender = buildEnvelopeLayout(openFlap({ flapDepthMm: 40 }), atMax).typography.sender;
    expect(shallowSender.namePx).toBeLessThan(deepSender.namePx);
    expect(shallowSender.namePx).toBeLessThan(recipient.namePx * FLAP_FACTOR);
    // הגודל הגדול ביותר שנכנס: ממלא את הלשונית בדיוק
    expect(estimateSenderHeightMm(shallowSender)).toBeCloseTo(flapSpace(30));
  });

  test('a 12mm flap gives the sender the minimum, the recipient does not change, and the warning stays', () => {
    const layout = buildEnvelopeLayout(openFlap({ flapDepthMm: 12 }), atMax);
    expect(layout).not.toBeNull();
    expect(layout.typography.recipient).toEqual(recipientAlone);
    expect(layout.typography.sender.linePx).toBeCloseTo(SENDER_MIN_LINE_PX);
    // גם במינימום הוא לא נכנס - הגלישה נמדדת ב-DOM ומקבלת אזהרה
    expect(estimateSenderHeightMm(layout.typography.sender)).toBeGreaterThan(flapSpace(12));
  });

  test('when the flap has room the sender is exactly 90% of the recipient', () => {
    const layout = buildEnvelopeLayout(openFlap(), { ...textStyle, fontScale: 1 });
    expect(layout.typography.sender.namePx).toBeCloseTo(layout.typography.recipient.namePx * FLAP_FACTOR);
    expect(layout.typography.sender.linePx).toBeCloseTo(layout.typography.recipient.linePx * FLAP_FACTOR);
  });

  test('the flap limit depends on the depth, not on the shape', () => {
    const senderOf = (flapShape) => buildEnvelopeLayout(openFlap({ flapDepthMm: 30, flapShape }), atMax).typography.sender;
    expect(senderOf('triangular')).toEqual(senderOf('straight'));
  });

  test('the flap does not limit the sender in the corner', () => {
    const { recipient, sender: corner } = buildEnvelopeLayout(frontCorner({ flapDepthMm: 12 }), atMax).typography;
    expect(corner.namePx).toBeCloseTo(recipient.namePx * CORNER_FACTOR);
    expect(getSenderTypographyLimit({ widthMm: 184, heightMm: 133 })).toBeNull();
  });
});

describe('the chosen font size', () => {
  test('changing the height to 1 and back brings back the chosen font size', () => {
    const chosen = 110;
    // אותה בחירה בכל שלב - שינוי המידות לא כותב לתוכה, רק הכתב בפועל משתנה. בגובה 100
    // המינימום (10pt) מעל הבחירה, ולכן הכתב בפועל גדל
    const effective = [133, 100, 1, '', 133].map((heightMm) => getEffectiveEnvelopeFontScale(chosen, settings(custom(184, heightMm))));
    expect(effective).toEqual([110, 115, 100, 100, 110]);
    expect(chosen).toBe(110);
  });

  test('the effective size follows the sender placement and the recipient lines', () => {
    const many = { nameLines: 2, detailLines: 15 };
    expect(getEffectiveEnvelopeFontScale(200, frontCorner(), many)).toBe(95);
    expect(getEffectiveEnvelopeFontScale(200, { ...frontCorner(), printSender: false }, many)).toBe(125);
    expect(getEffectiveEnvelopeFontScale(200, frontCorner())).toBe(125);
  });

  test('the layout prints the effective size, the same for every envelope of the run', () => {
    const many = { nameLines: 2, detailLines: 15 };
    const atCap = buildEnvelopeLayout(frontCorner(), { ...textStyle, fontScale: 95 }).typography.recipient;
    const short = buildEnvelopeLayout(frontCorner(), { ...textStyle, fontScale: 200 }, {
      recipientLines: LINES.reference, runRecipientLines: many,
    }).typography.recipient;
    const long = buildEnvelopeLayout(frontCorner(), { ...textStyle, fontScale: 200 }, {
      recipientLines: many, runRecipientLines: many,
    }).typography.recipient;
    expect(short).toEqual(atCap);
    expect(long).toEqual(atCap);
  });

  test.each([
    ['150', 150], [5000, 200], [1, 70], ['abc', 100], ['', 100], [null, 100],
  ])('a kept choice of %p is normalized to %p without looking at the envelope', (value, expected) => {
    expect(normalizeEnvelopeFontScale(value)).toBe(expected);
  });

  test('the effective size is the choice inside the range of the envelope', () => {
    const { min, max } = getEnvelopeFontScaleRange(settings());
    expect(getEffectiveEnvelopeFontScale(5000, settings())).toBe(max);
    expect(getEffectiveEnvelopeFontScale(1, settings())).toBe(min);
    // בחירה שמורה של 70% (למשל מהמדבקות) עולה למינימום של המעטפה
    expect(getEffectiveEnvelopeFontScale(70, settings())).toBe(85);
    expect(getEffectiveEnvelopeFontScale('abc', settings())).toBe(100);
  });
});

describe('front corner', () => {
  const sizes = [['a7', 184, 133], ['c6', 162, 114]];

  test.each(sizes)('%s: one page in the envelope size, closed, with the sender upright at the top', (sizeId, width, height) => {
    const layout = buildEnvelopeLayout(frontCorner({ sizeId }), textStyle);
    expect(layout.passes).toHaveLength(1);
    expect(layout.passes[0]).toMatchObject({ pageWidthMm: width, pageHeightMm: height });
    expect(layout.finishedViews).toBeNull();
    const senders = blockOf(layout.passes[0], 'senders');
    expect(senders.rotationDeg).toBe(0);
    expect(senders.rect.y).toBeCloseTo(getEnvelopeMargin({ widthMm: width, heightMm: height }));
  });

  test('auto side follows the recipient language, a manual side applies to everyone', () => {
    expect(resolveCornerSide('auto', 'he')).toBe('right');
    expect(resolveCornerSide('auto', 'en')).toBe('left');
    expect(resolveCornerSide('auto', undefined)).toBe('right');
    expect(resolveCornerSide('right', 'en')).toBe('right');
    expect(resolveCornerSide('left', 'he')).toBe('left');
  });

  test.each([
    ['auto', 'he', 'right'],
    ['auto', 'en', 'left'],
    ['right', 'en', 'right'],
    ['left', 'he', 'left'],
  ])('side %s with a %s recipient puts the sender on the %s', (cornerSide, recipientLanguage, side) => {
    const [pass] = buildEnvelopeLayout(frontCorner({ cornerSide }), textStyle, { recipientLanguage }).passes;
    const { rect, items } = blockOf(pass, 'senders');
    const margin = getEnvelopeMargin({ widthMm: 184, heightMm: 133 });
    if (side === 'right') expect(rect.x + rect.width).toBeCloseTo(184 - margin);
    else expect(rect.x).toBeCloseTo(margin);
    expect(items[0].textAlign).toBe(side);
  });

  test.each(sizes.flatMap(([sizeId]) => [[sizeId, 'he'], [sizeId, 'en']]))(
    '%s, %s recipient: the opposite top corner stays empty for a stamp',
    (sizeId, recipientLanguage) => {
      const layout = buildEnvelopeLayout(frontCorner({ sizeId }), textStyle, { recipientLanguage });
      const { pageWidthMm } = layout.passes[0];
      const senders = blockOf(layout.passes[0], 'senders').rect;
      expect(senders.width).toBeLessThan(pageWidthMm / 2);
      if (recipientLanguage === 'he') expect(senders.x).toBeGreaterThan(pageWidthMm / 2);
      else expect(senders.x + senders.width).toBeLessThan(pageWidthMm / 2);
      expect(recipientContent(layout).top).toBeGreaterThanOrEqual(senders.y + senders.height + CORNER_GAP_MM - 1e-9);
    },
  );

  test('at a regular font size the recipient is centered exactly like without a sender', () => {
    const corner = blockOf(buildEnvelopeLayout(frontCorner(), textStyle).passes[0], 'recipient');
    const alone = blockOf(buildEnvelopeLayout(settings(), textStyle).passes[0], 'recipient');
    expect(corner).toEqual(alone);
  });

  test('a recipient with many lines moves down just enough and does not overlap the sender', () => {
    const layout = buildEnvelopeLayout(frontCorner(custom(110, 80)), { ...textStyle, fontScale: 200 }, {
      recipientLines: LINES.worst, runRecipientLines: LINES.worst,
    });
    const [pass] = layout.passes;
    const senders = blockOf(pass, 'senders').rect;
    const recipient = blockOf(pass, 'recipient');
    expect(recipient.verticalAlign).toBe('top');
    expect(recipient.rect.y).toBeCloseTo(senders.y + senders.height + CORNER_GAP_MM);
    expect(overlaps(senders, recipient.rect)).toBe(false);
  });

  test('a short recipient stays centered even when another recipient of the run has many lines', () => {
    const size = frontCorner(custom(110, 80));
    const short = buildEnvelopeLayout(size, { ...textStyle, fontScale: 200 }, {
      recipientLines: LINES.reference, runRecipientLines: LINES.worst,
    });
    const runScale = getEffectiveEnvelopeFontScale(200, size, LINES.worst);
    const alone = buildEnvelopeLayout(settings(custom(110, 80)), { ...textStyle, fontScale: runScale });
    expect(blockOf(short.passes[0], 'recipient')).toEqual(blockOf(alone.passes[0], 'recipient'));
  });

  // 110x80 עם המקרה הגרוע לא נכנס גם במינימום - ר' 'when even the minimum does not fit'
  test.each([
    ['a7', { sizeId: 'a7' }, Object.values(LINES)],
    ['c6', { sizeId: 'c6' }, Object.values(LINES)],
    ['110x80', custom(110, 80), [LINES.reference, LINES.hebrewTypical]],
    ['350x260', custom(350, 260), Object.values(LINES)],
  ])('%s: at the maximum font no overlap and the gap from the bottom is kept, for every number of lines that fits', (_, size, lineProfiles) => {
    lineProfiles.forEach((lines) => {
      const layout = buildEnvelopeLayout(
        frontCorner({ ...size, senders: [fullSender] }),
        { ...textStyle, fontScale: 5000 },
        { recipientLines: lines, runRecipientLines: lines },
      );
      const { pageWidthMm: widthMm, pageHeightMm: heightMm } = layout.passes[0];
      const senders = blockOf(layout.passes[0], 'senders').rect;
      const content = recipientContent(layout, lines);
      expect(senders.height).toBeCloseTo(estimateSenderHeightMm(layout.typography.sender));
      expect(content.top).toBeGreaterThanOrEqual(senders.y + senders.height + CORNER_GAP_MM - 1e-9);
      expect(content.bottom).toBeLessThanOrEqual(heightMm - getCornerBottomGap({ widthMm, heightMm }) + 1e-9);
    });
  });

  test.each([
    [110, CORNER_MIN_SENDER_WIDTH_MM],
    [184, (184 - 2 * 5) * 0.45],
    [350, (350 - 2 * 13) * 0.45],
  ])('a %smm wide envelope: the sender block width, and room for a stamp is kept', (widthMm, expectedWidth) => {
    const heightMm = widthMm === 350 ? 260 : 80;
    const layout = buildEnvelopeLayout(frontCorner(custom(widthMm, heightMm)), { ...textStyle, fontScale: 200 });
    const senders = blockOf(layout.passes[0], 'senders').rect;
    const margin = getEnvelopeMargin({ widthMm, heightMm });
    expect(senders.width).toBeCloseTo(expectedWidth);
    expect(senders.width).toBeGreaterThanOrEqual(CORNER_MIN_SENDER_WIDTH_MM);
    expect(senders.x - margin).toBeGreaterThanOrEqual(CORNER_STAMP_MIN_MM - 1e-9);
  });

  test('with two senders only the first is printed, and the second is reported', () => {
    const layout = buildEnvelopeLayout(frontCorner({ senders: [sender, { ...sender, name: 'לוי' }] }), textStyle);
    const { items } = blockOf(layout.passes[0], 'senders');
    expect(items.map((item) => item.senderIndex)).toEqual([0]);
    expect(layout.omittedSenderCount).toBe(1);
  });

  test('an empty second sender is not reported', () => {
    expect(buildEnvelopeLayout(frontCorner({ senders: [sender, createEmptySender()] }), textStyle).omittedSenderCount).toBe(0);
    expect(buildEnvelopeLayout(openFlap({ senders: [sender, sender] }), textStyle).omittedSenderCount).toBe(0);
  });

  test('readiness needs only a complete first sender, and no flap', () => {
    expect(isEnvelopeSettingsReady(frontCorner())).toBe(true);
    expect(isEnvelopeSettingsReady(frontCorner({ senders: [sender, { ...createEmptySender(), name: 'חלקי' }] }))).toBe(true);
    expect(isEnvelopeSettingsReady(frontCorner({ flapDepthMm: '', flapShape: 'round' }))).toBe(true);
    expect(buildEnvelopeLayout(frontCorner({ flapDepthMm: 500 }), textStyle)).not.toBeNull();
    expect(isEnvelopeSettingsReady(frontCorner({ senders: [createEmptySender()] }))).toBe(false);
    expect(isEnvelopeSettingsReady(frontCorner({ senders: [] }))).toBe(false);
  });
});

describe('typography', () => {
  test.each([
    ['openFlap', openFlap, 0.9],
    ['frontCorner', frontCorner, 0.8],
  ])('%s: the sender uses the recipient font at the ratio of the mode', (_, build, factor) => {
    const { typography } = buildEnvelopeLayout(build(), { ...textStyle, fontWeight: 'bold' });
    expect(typography.sender.fontType).toBe(textStyle.fontType);
    expect(typography.sender.englishFontType).toBe(textStyle.englishFontType);
    expect(typography.sender.fontWeight).toBe('bold');
    expect(typography.sender.namePx).toBeCloseTo(typography.recipient.namePx * factor);
    expect(typography.sender.linePx).toBeCloseTo(typography.recipient.linePx * factor);
  });

  test('the chosen letter spacing level is passed to the recipient and the sender, and a bad value is normal', () => {
    const spaced = buildEnvelopeLayout(openFlap(), { ...textStyle, letterSpacing: 'wide' }).typography;
    expect(spaced.recipient.letterSpacing).toBe('wide');
    expect(spaced.sender.letterSpacing).toBe('wide');
    expect(buildEnvelopeLayout(openFlap(), { ...textStyle, letterSpacing: 'huge' }).typography.recipient.letterSpacing).toBe('normal');
    expect(buildEnvelopeLayout(openFlap(), textStyle).typography.recipient.letterSpacing).toBe('normal');
  });

  test('a future sender override replaces only what it sets', () => {
    const recipient = { fontFamily: 'Arial', fontWeight: 'normal', namePx: 20, linePx: 15 };
    expect(resolveSenderTypography(recipient, { factor: 0.8, override: { fontFamily: 'David' } })).toEqual({
      fontFamily: 'David', fontWeight: 'normal', namePx: 16, linePx: 12,
    });
  });

  test('the sender is raised to 8pt when the ratio or the flap would make it smaller, keeping its proportions', () => {
    const recipient = { namePx: 16, linePx: 13.5 };
    const raised = resolveSenderTypography(recipient, { factor: 0.5 });
    expect(raised.linePx).toBeCloseTo(SENDER_MIN_LINE_PX);
    expect(raised.namePx / raised.linePx).toBeCloseTo(16 / 13.5);
    const limited = resolveSenderTypography(recipient, { factor: 0.9, limit: { namePx: 4, linePx: 3 } });
    expect(limited.linePx).toBeCloseTo(SENDER_MIN_LINE_PX);
  });

  test('the text scales with the envelope', () => {
    const large = buildEnvelopeLayout(settings(), textStyle).typography.recipient;
    const small = buildEnvelopeLayout(settings({ sizeId: 'c6' }), textStyle).typography.recipient;
    expect(small.namePx).toBeLessThan(large.namePx);
  });

  test('the flap limit is the largest sender that fits the flap depth', () => {
    const dimensions = { widthMm: 184, heightMm: 133 };
    const limit = getSenderTypographyLimit(dimensions, 40);
    expect(estimateSenderHeightMm(limit)).toBeCloseTo(40 - 3 - getEnvelopeMargin(dimensions));
  });

  test('the sender is never larger than the recipient, at any font size and in any envelope', () => {
    [{}, { sizeId: 'c6' }, custom(110, 80), custom(350, 260)].forEach((size) => {
      [openFlap(size), frontCorner(size)].forEach((envelope) => {
        for (let scale = 70; scale <= 200; scale += 5) {
          const { recipient, sender: senderTypography } = buildEnvelopeLayout(envelope, { ...textStyle, fontScale: scale }).typography;
          expect(senderTypography.namePx).toBeLessThan(recipient.namePx);
          expect(senderTypography.linePx).toBeLessThan(recipient.linePx);
        }
      });
    });
  });
});

describe('recipient lines', () => {
  const printAll = () => true;
  const textOptions = {
    englishSalutation: '', emptyLineWhenNoAddress: true, greetingShow: true, greetingSeparateLine: true, greetingAlign: 'center',
  };
  const hebrew = { man: 'ישראל', woman: 'שרה', lastName: 'ישראלי', street: 'הרצל', houseNo: '1', city: 'ירושלים', country: 'ישראל' };

  test('a Hebrew recipient with "לכבוד" on its own line: two name lines, address and city', () => {
    expect(countRecipientLines([hebrew], printAll, textOptions)).toEqual({ nameLines: 2, detailLines: 2 });
  });

  test('"לכבוד" on the name line leaves one name line', () => {
    expect(countRecipientLines([hebrew], printAll, { ...textOptions, greetingSeparateLine: false }))
      .toEqual({ nameLines: 1, detailLines: 2 });
  });

  test('a Hebrew salutation for an English recipient is a name line of its own', () => {
    const english = { man: 'John', lastName: 'Smith', street: 'Main St', houseNo: '5', city: 'London', country: 'UK' };
    expect(countRecipientLines([english], printAll, { ...textOptions, englishSalutation: 'לכבוד' }))
      .toEqual({ nameLines: 2, detailLines: 3 });
    expect(countRecipientLines([english], printAll, { ...textOptions, englishSalutation: 'Mr.' }))
      .toEqual({ nameLines: 1, detailLines: 3 });
  });

  test('an empty address line is counted when it is kept, and extra columns are counted', () => {
    const noStreet = { ...hebrew, street: '', houseNo: '' };
    expect(countRecipientLines([noStreet], printAll, textOptions).detailLines).toBe(2);
    expect(countRecipientLines([noStreet], printAll, { ...textOptions, emptyLineWhenNoAddress: false }).detailLines).toBe(1);
    expect(countRecipientLines([{ ...hebrew, phone: '050', mail: 'a@b.c' }], printAll, textOptions).detailLines).toBe(4);
  });

  test('the run takes the most lines of any recipient, and no recipients means the reference', () => {
    const rows = [hebrew, { ...hebrew, phone: '050' }, { ...hebrew, country: 'צרפת' }];
    expect(countRecipientLines(rows, printAll, textOptions)).toEqual({ nameLines: 2, detailLines: 3 });
    expect(countRecipientLines([], printAll, textOptions)).toEqual(REFERENCE_RECIPIENT_LINES);
  });
});
