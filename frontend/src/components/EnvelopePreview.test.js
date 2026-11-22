import { act } from 'react';
import { createRoot } from 'react-dom/client';
import EnvelopeSheet from './EnvelopeSheet';
import { EnvelopeNotices, measureEnvelopeOverflow } from './EnvelopePreview';
import { buildEnvelopeLayout } from '../utils/envelopeLayout';
import { createDefaultEnvelopeSettings } from '../utils/envelopeFormats';
import { MODAL_TEXTS } from '../pages/HardCodePage';

// הגלישה נמדדת ב-DOM על הסימונים של EnvelopeSheet (data-envelope-*-box/-content). jsdom לא
// מחשב פריסה, ולכן המידות נקבעות כאן ידנית על האלמנטים שהמעטפה באמת מציירת - כך נבדק שהמדידה
// מוצאת כל תיבה (שולח בפינה, שתי עמודות על הלשונית, נמען בכל מעטפה) ומסיקה ממנה נכון
global.IS_REACT_ACT_ENVIRONMENT = true;

const row = { man: 'ישראל', woman: 'שרה', lastName: 'ישראלי', street: 'הרצל', houseNo: '1', city: 'ירושלים' };
const longSender = { name: 'משפחת הרב ישראל אברהם רוזנבלום', street: 'שדרות ירושלים', houseNo: '45', city: 'בני ברק', zip: '5126112', country: 'ישראל' };
const textOptions = {
  englishSalutation: '', emptyLineWhenNoAddress: true, greetingShow: true, greetingSeparateLine: true, greetingAlign: 'center',
};
const textStyle = { fontType: 'heebo', fontScale: 125, fontWeight: 'bold', letterSpacing: 'wider' };

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element) {
  // root.render של react-dom (Testing Library לא מותקנת). הכלל מזהה בטעות את השם render
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => root.render(element));
}

function renderEnvelopes(settings, count = 1) {
  const layout = buildEnvelopeLayout(settings, textStyle);
  render(
    <>
      {Array.from({ length: count }, (_, index) => (
        <EnvelopeSheet
          key={index}
          surface={layout.passes[0]}
          row={row}
          senders={settings.senders}
          typography={layout.typography}
          textOptions={textOptions}
          getPrintFlag={() => true}
        />
      ))}
    </>,
  );
  return layout;
}

const setSize = (element, sizes) => Object.entries(sizes).forEach(([key, value]) => {
  Object.defineProperty(element, key, { configurable: true, value });
});
const boxes = (role) => Array.from(container.querySelectorAll(`[data-envelope-${role}-box]`));
const contentOf = (box, role) => box.querySelector(`[data-envelope-${role}-content]`);

// כל התיבות "נכנסות": התוכן בגודל התיבה
function fitAll() {
  ['sender', 'recipient'].forEach((role) => boxes(role).forEach((box) => {
    setSize(box, { clientHeight: 100, clientWidth: 200 });
    setSize(contentOf(box, role), { offsetHeight: 100, scrollWidth: 200 });
  }));
}

const corner = () => ({ ...createDefaultEnvelopeSettings(), printSender: true, senderPlacement: 'frontCorner', senders: [longSender] });
const twoOnFlap = (flapShape = 'straight') => ({
  ...createDefaultEnvelopeSettings(), printSender: true, senderPlacement: 'openFlap', flapShape, senders: [longSender, longSender],
});

describe('measuring overflow on the drawn envelope', () => {
  test('nothing overflows when every box holds its content', () => {
    renderEnvelopes(corner());
    fitAll();
    expect(measureEnvelopeOverflow(container)).toEqual({ sender: false, recipients: 0 });
  });

  test('a long sender name that wraps in the corner is taller than its box: sender overflow', () => {
    renderEnvelopes(corner());
    fitAll();
    const [box] = boxes('sender');
    // התיבה בפינה בגובה של 4 שורות בדיוק, ולכן שורה שנשברה היא שורה חמישית
    setSize(contentOf(box, 'sender'), { offsetHeight: 125 });
    expect(measureEnvelopeOverflow(container)).toEqual({ sender: true, recipients: 0 });
  });

  test('a word too wide for the corner is an overflow, but a 1px rounding difference is not', () => {
    renderEnvelopes(corner());
    fitAll();
    const content = contentOf(boxes('sender')[0], 'sender');
    setSize(content, { scrollWidth: 201 });
    expect(measureEnvelopeOverflow(container).sender).toBe(false);
    setSize(content, { scrollWidth: 202 });
    expect(measureEnvelopeOverflow(container).sender).toBe(true);
  });

  test.each([['straight'], ['triangular']])(
    'two senders on a %s flap: each column is measured, and one overflowing column is enough',
    (flapShape) => {
      renderEnvelopes(twoOnFlap(flapShape));
      fitAll();
      const senderBoxes = boxes('sender');
      expect(senderBoxes).toHaveLength(2);
      setSize(contentOf(senderBoxes[1], 'sender'), { offsetHeight: 130 });
      expect(measureEnvelopeOverflow(container)).toEqual({ sender: true, recipients: 0 });
    },
  );

  test('recipients are counted per envelope', () => {
    renderEnvelopes(corner(), 3);
    fitAll();
    const recipientBoxes = boxes('recipient');
    expect(recipientBoxes).toHaveLength(3);
    [recipientBoxes[0], recipientBoxes[2]].forEach((box) => setSize(contentOf(box, 'recipient'), { offsetHeight: 140 }));
    expect(measureEnvelopeOverflow(container)).toEqual({ sender: false, recipients: 2 });
  });
});

describe('the overflow notices', () => {
  const textOf = () => container.textContent;

  test('a sender overflow in the corner gets the corner message, and on the flap the flap message', () => {
    render(<EnvelopeNotices layout={{ senderMode: 'frontCorner', omittedSenderCount: 0 }} overflow={{ sender: true, recipients: 0 }} />);
    expect(textOf()).toContain(MODAL_TEXTS.ENVELOPE_SENDER_CORNER_OVERFLOW);
    expect(textOf()).not.toContain(MODAL_TEXTS.ENVELOPE_SENDER_OVERFLOW);

    render(<EnvelopeNotices layout={{ senderMode: 'openFlap', omittedSenderCount: 0 }} overflow={{ sender: true, recipients: 0 }} />);
    expect(textOf()).toContain(MODAL_TEXTS.ENVELOPE_SENDER_OVERFLOW);
  });

  test('on the print page the recipient message says in how many envelopes', () => {
    render(<EnvelopeNotices layout={{ senderMode: 'none', omittedSenderCount: 0 }} overflow={{ sender: false, recipients: 3 }} countRecipients />);
    expect(textOf()).toContain(MODAL_TEXTS.ENVELOPE_RECIPIENT_OVERFLOW(3));
  });

  test('no overflow, no notices', () => {
    render(<EnvelopeNotices layout={{ senderMode: 'frontCorner', omittedSenderCount: 0 }} overflow={{ sender: false, recipients: 0 }} />);
    expect(textOf()).toBe('');
  });
});
