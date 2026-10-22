import { fitLabelText, fittedFontSize, LABEL_FIT_VAR, MIN_LABEL_FIT } from './labelFit';

// מדבקה מדומה: גובה הטקסט פרופורציונלי לגודל הכתב (המשתנה --label-fit), כמו בדפדפן
// (content נקרא בכל מדידה - כדי שבדיקה תוכל לשנות את הטקסט אחרי ההתאמה הראשונה)
function fakeLabel(content, height = 100, width = 100) {
  const label = document.createElement('div');
  const fit = () => Number(label.style.getPropertyValue(LABEL_FIT_VAR) || 1);
  Object.defineProperty(label, 'clientHeight', { get: () => height });
  Object.defineProperty(label, 'clientWidth', { get: () => width });
  Object.defineProperty(label, 'scrollHeight', { get: () => Math.max(height, Math.round(content.height * fit())) });
  Object.defineProperty(label, 'scrollWidth', { get: () => Math.max(width, Math.round((content.width ?? 100) * fit())) });
  return label;
}

test('text that fits keeps its full size', () => {
  const label = fakeLabel({ height: 80 });

  expect(fitLabelText(label)).toBe(1);
  expect(label.style.getPropertyValue(LABEL_FIT_VAR)).toBe('1');
});

test('text taller than the label (long name and long address) shrinks until it fits', () => {
  const label = fakeLabel({ height: 150 });

  const fit = fitLabelText(label);

  expect(fit).toBeLessThan(1);
  expect(150 * fit).toBeLessThanOrEqual(101);
  // הצעד הקודם עוד לא נכנס - לא מקטינים יותר מהנדרש
  expect(150 * (fit + 0.05)).toBeGreaterThan(101);
});

test('text wider than the label shrinks too', () => {
  const label = fakeLabel({ height: 50, width: 125 });

  expect(fitLabelText(label)).toBe(0.8);
});

test('never shrinks below the readable minimum', () => {
  const label = fakeLabel({ height: 1000 });

  expect(fitLabelText(label)).toBe(MIN_LABEL_FIT);
});

test('a label measured again after its text got shorter goes back to full size', () => {
  const content = { height: 150 };
  const label = fakeLabel(content);
  fitLabelText(label);

  content.height = 80;

  expect(fitLabelText(label)).toBe(1);
});

test('font sizes scale with the label', () => {
  expect(fittedFontSize(12)).toBe('calc(12px * var(--label-fit, 1))');
});
