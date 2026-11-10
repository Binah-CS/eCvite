import {
  SENDER_FONT_FACTOR,
  SENDER_MODES,
  buildEnvelopeLayout,
  clampEnvelopeFontScale,
  getEnvelopeMargin,
  getMaxEnvelopeFontScale,
  isEnvelopeSettingsReady,
  resolveSenderTypography,
} from './envelopeLayout';
import { createDefaultEnvelopeSettings, createEmptySender } from './envelopeFormats';

const textStyle = { fontType: 'Arial, sans-serif', fontScale: 100, fontWeight: 'regular' };
const sender = { ...createEmptySender(), name: 'כהן', street: 'הרצל', houseNo: '12', city: 'ירושלים' };
const settings = (overrides = {}) => ({ ...createDefaultEnvelopeSettings(), ...overrides });
const openFlap = (overrides = {}) => settings({ senderMode: 'openFlap', senders: [sender], ...overrides });
const blockOf = (surface, role) => surface.blocks.find((block) => block.role === role);

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
    expect(getEnvelopeMargin({ widthMm: 60, heightMm: 40 })).toBe(5);
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
    expect(buildEnvelopeLayout(settings({ sizeId: 'custom', customSize: { widthMm: '', heightMm: 100 } }), textStyle)).toBeNull();
  });

  test('no layout for a flap deeper than the envelope', () => {
    expect(buildEnvelopeLayout(openFlap({ flapDepthMm: 200 }), textStyle)).toBeNull();
  });

  test('an unknown mode gives no layout', () => {
    expect(buildEnvelopeLayout(settings({ senderMode: 'nope' }), textStyle)).toBeNull();
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
    expect(Object.keys(SENDER_MODES)).toEqual(['none', 'openFlap']);
  });
});

describe('typography', () => {
  test('the sender uses the recipient font at 80%', () => {
    const { typography } = buildEnvelopeLayout(openFlap(), { ...textStyle, fontWeight: 'bold' });
    expect(typography.sender.fontFamily).toBe(textStyle.fontType);
    expect(typography.sender.fontWeight).toBe('bold');
    expect(typography.sender.namePx).toBeCloseTo(typography.recipient.namePx * SENDER_FONT_FACTOR);
    expect(typography.sender.linePx).toBeCloseTo(typography.recipient.linePx * SENDER_FONT_FACTOR);
  });

  test('a future sender override replaces only what it sets', () => {
    const recipient = { fontFamily: 'Arial', fontWeight: 'normal', namePx: 20, linePx: 10 };
    expect(resolveSenderTypography(recipient, { fontFamily: 'David' })).toEqual({
      fontFamily: 'David', fontWeight: 'normal', namePx: 16, linePx: 8,
    });
  });

  test('the text scales with the envelope', () => {
    const large = buildEnvelopeLayout(settings(), textStyle).typography.recipient;
    const small = buildEnvelopeLayout(settings({ sizeId: 'c6' }), textStyle).typography.recipient;
    expect(small.namePx).toBeLessThan(large.namePx);
  });

  test('the font scale is limited to what fits and never below the minimum', () => {
    const dimensions = { widthMm: 184, heightMm: 133 };
    expect(clampEnvelopeFontScale(5000, dimensions)).toBe(getMaxEnvelopeFontScale(dimensions));
    expect(clampEnvelopeFontScale(1, dimensions)).toBe(70);
    expect(clampEnvelopeFontScale('abc', dimensions)).toBe(100);
  });
});
