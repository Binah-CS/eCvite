import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import PrintPreviewPage from './PrintPreviewPage';

// #142 - שינויים שלא נשמרו לא הולכים לאיבוד בלחיצה על "הדפסה", והחזרה מהתצוגה המקדימה
// מחזירה את הטבלה כמו שהייתה (מהעותק המקומי, עם אותו סינון) - בלי טעינה מחדש מה-DB
global.IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: (t) => ({ width: String(t).length * 7 }) });
window.print = () => {};
// כל בדיקה כאן עוברת תהליך שלם (טבלה, הדפסה, תצוגה מקדימה וחזרה) - יותר מ-5 השניות של ברירת המחדל
jest.setTimeout(30000);

const mockRecipients = [
  { hashCode: 'a', id: 'a', man: 'משה', lastName: 'כהן', city: 'אלעד', street: 'הרצל', houseNo: '1' },
  { hashCode: 'b', id: 'b', man: 'אהרן', lastName: 'לוי', city: 'אלעד', street: 'הרצל', houseNo: '2' },
  { hashCode: 'c', id: 'c', man: 'דוד', lastName: 'פרץ', city: 'חיפה', street: 'יפו', houseNo: '3' },
];
const mockColumns = ['man', 'lastName', 'street', 'houseNo', 'city'].map((technicalName, i) => ({
  technicalName, displayName: technicalName, isRequired: false, defaultOrder: i + 1, isVisible: true,
}));
// כמה פעמים נקראה כל פונקציה של ה-api - כדי לדעת אם הטבלה נטענה מה-DB ואם נשמר משהו
const mockCalls = {};
// כמו ה-DB האמיתי - רשומות בלי id, רק hashCode
const mockServer = { withoutIds: false };
jest.mock('../services/api', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (target, name) => (...args) => {
      mockCalls[name] = (mockCalls[name] || 0) + 1;
      if (name === 'getRecipients') {
        return Promise.resolve({ data: mockServer.withoutIds ? mockRecipients.map(({ id, ...row }) => row) : mockRecipients });
      }
      if (name === 'getRecipientColumns') return Promise.resolve({ data: mockColumns });
      if (name === 'saveRecordsInOrder') {
        mockCalls.lastSave = { recipients: args[1], hashCodesToDelete: args[2] };
        return Promise.resolve({ data: args[1] });
      }
      return Promise.resolve({ data: [] });
    },
  }),
}));

const wait = (ms = 100) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

// מחכה עד שהתנאי מתקיים (עד 5 שניות) - כשכל הבדיקות רצות יחד המחשב עמוס והדף נטען לאט
// יותר, אז המתנה קבועה לא מספיקה תמיד
const waitFor = async (condition, what) => {
  for (let i = 0; i < 100; i += 1) {
    const result = condition();
    if (result) return result;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const findButton = (text) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

const clickButton = async (text) => {
  const button = await waitFor(() => findButton(text), `button "${text}"`);
  await act(async () => { button.click(); });
  await wait();
};

const waitForTable = () => waitFor(() => document.body.querySelector('.MuiDataGrid-row'), 'table rows');

const searchInput = () => [...document.body.querySelectorAll('.MuiTextField-root')]
  .find((field) => field.textContent.includes('חיפוש בכל העמודות'))
  ?.querySelector('input');

const search = async (text) => {
  const input = await waitFor(searchInput, 'search input');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait();
};

// השמות של השורות שמוצגות בטבלה - לפי מזהה השורה (data-id), כי בסביבת הבדיקות התאים לא מציגים טקסט
const tableNames = () => [...document.body.querySelectorAll('.MuiDataGrid-row')]
  .map((row) => mockRecipients.find((r) => r.id === row.getAttribute('data-id'))?.man)
  .filter(Boolean);

// מחיקת שורה בלי לשמור - דרך תפריט הלחיצה הימנית (שינוי שלא נשמר)
const deleteRowWithoutSaving = async (id) => {
  const cell = await waitFor(
    () => document.body.querySelector(`.MuiDataGrid-row[data-id="${id}"] .MuiDataGrid-cell[data-field="man"]`),
    `cell of row ${id}`
  );
  await act(async () => {
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
  });
  const item = await waitFor(
    () => [...document.body.querySelectorAll('.MuiMenu-paper li')].find((li) => li.textContent.includes('מחק שורה')),
    'the "מחק שורה" menu item'
  );
  await act(async () => { item.click(); });
  await wait();
};

// דף הגדרות מינימלי לבדיקה - רק כפתור חזרה לטבלה (מה שקורה ב"שמור" / חזרה מההגדרות)
function FakeSettingsPage() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/dashboard')}>חזרה לטבלה</button>;
}

const goToSettingsAndBack = async () => {
  const avatarButton = await waitFor(
    () => [...document.body.querySelectorAll('button')].find((b) => b.querySelector('.MuiAvatar-root')),
    'the profile button'
  );
  await act(async () => { avatarButton.click(); });
  const settingsItem = await waitFor(
    () => [...document.body.querySelectorAll('li')].find((li) => li.textContent.includes('הגדרות')),
    'the "הגדרות" menu item'
  );
  await act(async () => { settingsItem.click(); });
  await clickButton('חזרה לטבלה');
  await waitForTable();
};

const renderApp = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // זה ה-render של React (createRoot), לא של Testing Library - ו-React דורש act סביבו
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/print-preview" element={<PrintPreviewPage />} />
          <Route path="/settings" element={<FakeSettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
  });
  await waitForTable();
};

const goToPreviewAndBack = async () => {
  await clickButton('הדפסה');
  await clickButton('המשך');
  await clickButton('תצוגה מקדימה');
  await clickButton('ביטול וחזרה');
  await waitForTable();
};

// הדף של הבדיקה הקודמת נסגר כמו שצריך (unmount) לפני שמנקים - אחרת React מנסה להסיר צמתים שכבר נמחקו
let root = null;
afterEach(async () => {
  if (root) {
    await act(async () => { root.unmount(); });
    root = null;
  }
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = '';
  Object.keys(mockCalls).forEach((name) => { delete mockCalls[name]; });
  mockServer.withoutIds = false;
  sessionStorage.setItem('user', JSON.stringify({ phone: '0500000000' }));
});

// ---- 1. שינויים שלא נשמרו ----

test('unsaved change + "הדפסה": a message appears and nothing is lost', async () => {
  await renderApp();
  await deleteRowWithoutSaving('c');
  expect(tableNames()).toEqual(['משה', 'אהרן']);

  await clickButton('הדפסה');

  expect(document.body.textContent).toContain('שינויים שלא נשמרו');
  expect(findButton('שמור והדפס')).toBeTruthy();
  expect(tableNames()).toEqual(['משה', 'אהרן']);
});

test('"ביטול" in the message keeps the unsaved change and does not open printing', async () => {
  await renderApp();
  await deleteRowWithoutSaving('c');
  await clickButton('הדפסה');

  await clickButton('ביטול');

  expect(tableNames()).toEqual(['משה', 'אהרן']);
  expect(document.body.textContent).not.toContain('על מה תרצה להדפיס?');
  expect(mockCalls.saveRecordsInOrder || 0).toBe(0);
});

test('"שמור והדפס" saves and then opens printing', async () => {
  await renderApp();
  await deleteRowWithoutSaving('c');
  await clickButton('הדפסה');

  await clickButton('שמור והדפס');
  await waitFor(() => document.body.textContent.includes('על מה תרצה להדפיס?'), 'the print dialog');

  expect(mockCalls.saveRecordsInOrder).toBe(1);
  expect(document.body.textContent).toContain('על מה תרצה להדפיס?');
});

test('no unsaved changes: "הדפסה" opens printing directly, as before', async () => {
  await renderApp();

  await clickButton('הדפסה');
  await waitFor(() => document.body.textContent.includes('על מה תרצה להדפיס?'), 'the print dialog');

  expect(document.body.textContent).not.toContain('שינויים שלא נשמרו');
  expect(document.body.textContent).toContain('על מה תרצה להדפיס?');
});

// ---- 2. חזרה מהתצוגה המקדימה - מהעותק המקומי ----

test('"ביטול וחזרה" does not reload the table from the DB', async () => {
  await renderApp();
  await clickButton('הדפסה');
  await waitFor(() => document.body.textContent.includes('על מה תרצה להדפיס?'), 'the print dialog');
  const callsBeforeReturn = mockCalls.getRecipients;

  await clickButton('המשך');
  await clickButton('תצוגה מקדימה');
  await clickButton('ביטול וחזרה');
  await waitForTable();

  expect(mockCalls.getRecipients).toBe(callsBeforeReturn);
  expect(tableNames()).toEqual(['משה', 'אהרן', 'דוד']);
});

// "הדפסה" שומרת בעותק המקומי את הרשומות מה-DB, שאין להן id - והחזרה דילגה עליהן, העותק
// נראה ריק והטבלה נטענה שוב מה-DB (עיגול טעינה)
test('"ביטול וחזרה" does not reload from the DB when the DB rows have no id (only hashCode)', async () => {
  mockServer.withoutIds = true;
  await renderApp();
  await clickButton('הדפסה');
  await waitFor(() => document.body.textContent.includes('על מה תרצה להדפיס?'), 'the print dialog');
  const callsBeforeReturn = mockCalls.getRecipients;

  await clickButton('המשך');
  await clickButton('תצוגה מקדימה');
  await clickButton('ביטול וחזרה');
  await waitForTable();

  expect(mockCalls.getRecipients).toBe(callsBeforeReturn);
  expect(tableNames()).toEqual(['משה', 'אהרן', 'דוד']);
});

test('returning from Settings with an unsaved change shows the local table, keeps the change and still asks before printing', async () => {
  await renderApp();
  await deleteRowWithoutSaving('c');

  await goToSettingsAndBack();

  expect(tableNames()).toEqual(['משה', 'אהרן']);
  await clickButton('הדפסה');
  expect(document.body.textContent).toContain('שינויים שלא נשמרו');

  // המחיקה שלא נשמרה לפני המעבר להגדרות - נשלחת ל-DB בשמירה
  await clickButton('שמור והדפס');
  await waitFor(() => mockCalls.lastSave, 'the save request');
  expect(mockCalls.lastSave.hashCodesToDelete).toEqual(['c']);
});

// ---- 3. הסינון נשמר ----

test('"ביטול וחזרה" brings the table back with the same filter', async () => {
  await renderApp();
  await search('אלעד');
  expect(tableNames()).toEqual(['משה', 'אהרן']);

  await goToPreviewAndBack();

  expect(searchInput().value).toBe('אלעד');
  expect(tableNames()).toEqual(['משה', 'אהרן']);
});

test('a filter saved for another user is not applied', async () => {
  sessionStorage.setItem('tableView-0599999999', JSON.stringify({ inputValue: 'אלעד', activeFilters: [], filterConditions: [], sortModel: [] }));

  await renderApp();

  expect(searchInput().value).toBe('');
  expect(tableNames()).toEqual(['משה', 'אהרן', 'דוד']);
});
