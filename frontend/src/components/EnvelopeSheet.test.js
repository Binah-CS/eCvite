import { act } from 'react';
import { createRoot } from 'react-dom/client';
import EnvelopeSheet from './EnvelopeSheet';
import { buildEnvelopeLayout } from '../utils/envelopeLayout';
import { createDefaultEnvelopeSettings } from '../utils/envelopeFormats';

// ציור אמיתי של מעטפה (React בלי ספריות נוספות), כדי לבדוק את הסגנון שבאמת יוצא לכל שורה
global.IS_REACT_ACT_ENVIRONMENT = true;

const hebrewRow = { man: 'ישראל', woman: 'שרה', lastName: 'ישראלי', street: 'הרצל', houseNo: '1', city: 'ירושלים' };
const englishSender = { name: 'Cohen', street: 'Main St', houseNo: '5', city: 'London', zip: '', country: '' };
const textOptions = {
  englishSalutation: '', emptyLineWhenNoAddress: true, greetingShow: true, greetingSeparateLine: true, greetingAlign: 'center',
};

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

function renderEnvelope(textStyle) {
  const settings = { ...createDefaultEnvelopeSettings(), printSender: true, senderPlacement: 'openFlap', senders: [englishSender] };
  const layout = buildEnvelopeLayout(settings, textStyle);
  // root.render של react-dom (לא של Testing Library, שלא מותקנת), ובלי act הציור לא מסתיים
  // לפני הבדיקה. הכלל מזהה בטעות את השם render
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => {
    root.render(
      <EnvelopeSheet
        surface={layout.passes[0]}
        row={hebrewRow}
        senders={settings.senders}
        typography={layout.typography}
        textOptions={textOptions}
        getPrintFlag={() => true}
      />,
    );
  });
  const lines = (selector) => Array.from(container.querySelectorAll(`${selector} > div`));
  return { recipient: lines('[data-envelope-recipient-content]'), sender: lines('[data-envelope-sender-content]') };
}

describe('the printed address style', () => {
  test('every line of the recipient and the sender is solid black, including the address lines', () => {
    const { recipient, sender } = renderEnvelope({ fontType: 'heebo', fontScale: 100, fontWeight: 'bold' });
    expect(recipient.length).toBeGreaterThan(2);
    expect(sender.length).toBeGreaterThan(2);
    [...recipient, ...sender].forEach((line) => {
      expect(line.style.color).toBe('rgb(0, 0, 0)');
      expect(line.style.fontWeight).toBe('bold');
    });
  });

  test('each address gets the spacing of its own language font: Hebrew spaced, English in a connected font not', () => {
    const { recipient, sender } = renderEnvelope({
      fontType: 'heebo', englishFontType: 'dancing-script', fontScale: 100, fontWeight: 'regular', letterSpacing: 'wider',
    });
    recipient.forEach((line) => expect(line.style.letterSpacing).toBe('0.08em'));
    sender.forEach((line) => expect(line.style.letterSpacing).toBe('normal'));
  });

  test('without a chosen level nothing is spaced', () => {
    const { recipient, sender } = renderEnvelope({ fontType: 'heebo', fontScale: 100, fontWeight: 'regular' });
    [...recipient, ...sender].forEach((line) => expect(line.style.letterSpacing).toBe('normal'));
  });
});
