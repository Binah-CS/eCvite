import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

// #79 - בדף ההגדרות, ב"עמודות להצגה", גוררים עמודה כדי לשנות את המיקום שלה בטבלה,
// והסדר נשמר אצל המשתמשת (columnPreferences.__order) ב"שמור שינויים"
global.IS_REACT_ACT_ENVIRONMENT = true;

const mockColumns = [
  { technicalName: 'man', displayName: 'שם', defaultOrder: 1 },
  { technicalName: 'street', displayName: 'רחוב', defaultOrder: 2 },
  { technicalName: 'city', displayName: 'עיר', defaultOrder: 3 },
];
const mockSaved = {};
jest.mock('../services/excelColumnsCache', () => ({
  getExcelColumns: () => Promise.resolve(mockColumns),
  refreshExcelColumns: () => Promise.resolve(mockColumns),
}));
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    updateColumnPreferences: (phone, columnPreferences) => {
      mockSaved.columnPreferences = columnPreferences;
      return Promise.resolve({ data: { phone, columnPreferences } });
    },
  },
}));

let root = null;
const wait = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });

const renderSettings = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // זה ה-render של React (createRoot), לא של Testing Library - ו-React דורש act סביבו
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    root = createRoot(container);
    root.render(<MemoryRouter><SettingsPage /></MemoryRouter>);
  });
  await wait();
};

// הרשימה הראשונה היא "עמודות להצגה" - השמות לפי הסדר שמוצג בה
const showListNames = () => [...document.body.querySelectorAll('ul')[1].querySelectorAll('[draggable="true"]')]
  .map((item) => item.textContent);

const itemOf = (name) => [...document.body.querySelectorAll('[draggable="true"]')]
  .find((item) => item.textContent === name);

const drag = async (sourceName, targetName) => {
  const fire = (element, type) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = { effectAllowed: '', setData: () => {} };
    element.dispatchEvent(event);
  };
  await act(async () => { fire(itemOf(sourceName), 'dragstart'); });
  await act(async () => { fire(itemOf(targetName), 'dragenter'); });
  await act(async () => { fire(itemOf(targetName), 'drop'); fire(itemOf(sourceName), 'dragend'); });
};

const clickSave = async () => {
  const button = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'שמור שינויים');
  await act(async () => { button.click(); });
  await wait();
};

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '';
  Object.keys(mockSaved).forEach((key) => { delete mockSaved[key]; });
  sessionStorage.setItem('user', JSON.stringify({ phone: '0500000000' }));
});

afterEach(async () => {
  if (root) {
    await act(async () => { root.unmount(); });
    root = null;
  }
});

test('the list shows a hint that columns can be dragged', async () => {
  await renderSettings();
  expect(document.body.textContent).toContain('אפשר לגרור עמודה');
});

test('the columns appear in the order of the table - the saved order of the user', async () => {
  sessionStorage.setItem('user', JSON.stringify({
    phone: '0500000000', columnPreferences: JSON.stringify({ __order: ['city', 'man', 'street'] }),
  }));
  await renderSettings();

  expect(showListNames()).toEqual(['עיר', 'שם', 'רחוב']);
});

test('dragging a column moves it, and "שמור שינויים" saves the new order for the user', async () => {
  await renderSettings();
  expect(showListNames()).toEqual(['שם', 'רחוב', 'עיר']);

  await drag('עיר', 'שם');
  expect(showListNames()).toEqual(['עיר', 'שם', 'רחוב']);

  // רק הרשימה שבה גוררים מושפעת - "עמודות להדפסה" נשארת בסדר הקבוע ובלי הדגשה
  const printList = document.body.querySelectorAll('ul')[2];
  expect([...printList.querySelectorAll('[role="button"]')].map((item) => item.textContent)).toEqual(['שם', 'רחוב', 'עיר']);
  expect(printList.querySelector('[draggable="true"]')).toBeNull();

  await clickSave();
  expect(JSON.parse(mockSaved.columnPreferences).__order).toEqual(['city', 'man', 'street']);
});

test('while dragging, only the dragged row in "עמודות להצגה" is highlighted - not the same column in "עמודות להדפסה"', async () => {
  await renderSettings();
  const event = new Event('dragstart', { bubbles: true, cancelable: true });
  event.dataTransfer = { effectAllowed: '' };
  await act(async () => { itemOf('עיר').dispatchEvent(event); });

  const opacityIn = (list) => window.getComputedStyle(
    [...document.body.querySelectorAll('ul')[list].querySelectorAll('[role="button"]')].find((item) => item.textContent === 'עיר')
  ).opacity;
  expect(opacityIn(1)).toBe('0.5');
  expect(opacityIn(2)).not.toBe('0.5');
});

test('without dragging, no order is saved - the user keeps getting the default order', async () => {
  await renderSettings();

  await clickSave();

  expect(JSON.parse(mockSaved.columnPreferences).__order).toBeUndefined();
});
