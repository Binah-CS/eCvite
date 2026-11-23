import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import PrintPreviewPage from './PrintPreviewPage';

// #118 - כשלא מסמנים שורות, ההדפסה לוקחת את מה שמוצג בטבלה (הכל, או מה שבסינון).
// הבאג: אחרי "ביטול וחזרה" מהתצוגה המקדימה, השורות שהודפסו חזרו לטבלה כאילו הן "שורות
// מסומנות" (sessionStorage), וההדפסה הבאה הדפיסה אותן שוב - בלי קשר לסינון החדש
global.IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: (t) => ({ width: String(t).length * 7 }) });
window.print = () => {};

const mockRecipients = [
  { hashCode: 'a', id: 'a', man: 'משה', lastName: 'כהן', city: 'אלעד', street: 'הרצל', houseNo: '1' },
  { hashCode: 'b', id: 'b', man: 'אהרן', lastName: 'לוי', city: 'אלעד', street: 'הרצל', houseNo: '2' },
  { hashCode: 'c', id: 'c', man: 'דוד', lastName: 'פרץ', city: 'חיפה', street: 'יפו', houseNo: '3' },
];
const mockColumns = ['man', 'lastName', 'street', 'houseNo', 'city'].map((technicalName, i) => ({
  technicalName, displayName: technicalName, isRequired: false, defaultOrder: i + 1, isVisible: true,
}));
jest.mock('../services/api', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (target, name) => () => Promise.resolve({
      data: name === 'getRecipients' ? mockRecipients : name === 'getRecipientColumns' ? mockColumns : [],
    }),
  }),
}));

const wait = (ms = 100) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

const clickButton = async (text) => {
  const button = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  if (!button) throw new Error(`no button "${text}"`);
  await act(async () => { button.click(); });
  await wait();
};

// הקלדה בשורת החיפוש של הטבלה (React דורש לעבור דרך ה-setter הטבעי כדי שה-onChange ירוץ)
const search = async (text) => {
  const input = [...document.body.querySelectorAll('.MuiTextField-root')]
    .find((field) => field.textContent.includes('חיפוש בכל העמודות'))
    ?.querySelector('input');
  if (!input) throw new Error('no search input');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait();
};

// מהטבלה: "הדפסה", מדבקות, "המשך", "תצוגה מקדימה" - ומחזיר את השמות שמופיעים בתצוגה המקדימה
const printPreviewNames = async () => {
  await clickButton('הדפסה');
  await wait(200);
  await clickButton('המשך');
  await clickButton('תצוגה מקדימה');
  const text = document.body.textContent;
  return mockRecipients.map((r) => r.man).filter((name) => text.includes(name));
};

const renderApp = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // זה ה-render של React (createRoot), לא של Testing Library - ו-React דורש act סביבו
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/print-preview" element={<PrintPreviewPage />} />
        </Routes>
      </MemoryRouter>
    );
  });
  await wait(300);
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = '';
  sessionStorage.setItem('user', JSON.stringify({ phone: '0500000000' }));
});

test('after "ביטול וחזרה", printing again uses the new filter, not the rows printed before', async () => {
  await renderApp();

  await search('אלעד');
  expect(await printPreviewNames()).toEqual(['משה', 'אהרן']);

  await clickButton('ביטול וחזרה');
  await wait(300);
  await search('חיפה');
  expect(await printPreviewNames()).toEqual(['דוד']);
});

test('after "ביטול וחזרה" with no filter, printing again prints the whole table', async () => {
  await renderApp();

  await search('אלעד');
  expect(await printPreviewNames()).toEqual(['משה', 'אהרן']);

  await clickButton('ביטול וחזרה');
  await wait(300);
  expect(await printPreviewNames()).toEqual(['משה', 'אהרן', 'דוד']);
});

// שארית מגרסה קודמת (לפני התיקון) בלשונית שהייתה פתוחה - השורות שהודפסו נשמרו אז כ"מסומנות"
test('leftover printed rows from the old version are not restored as a selection', async () => {
  const leftover = mockRecipients.filter((r) => r.city === 'אלעד');
  sessionStorage.setItem('dashboardSelectedIds', JSON.stringify(leftover.map((r) => r.id)));
  sessionStorage.setItem('dashboardSelectedRows', JSON.stringify(leftover));

  await renderApp();

  expect(await printPreviewNames()).toEqual(['משה', 'אהרן', 'דוד']);
});

test('rows that were really selected stay selected after "ביטול וחזרה"', async () => {
  await renderApp();

  const checkbox = document.body.querySelector('.MuiDataGrid-row[data-id="c"] input[type="checkbox"]');
  await act(async () => { checkbox.click(); });
  await wait();
  expect(await printPreviewNames()).toEqual(['דוד']);

  await clickButton('ביטול וחזרה');
  await wait(300);
  expect(await printPreviewNames()).toEqual(['דוד']);
});
