import api from '../services/api';
import {
  loadEnvelopePrintSettings,
  loadLabelPrintSettings,
  saveEnvelopePrintSettings,
  saveFontWeightForReturn,
  saveLabelPrintSettings,
} from './labelPrintSettings';
import { resolveFontWeight } from '../fonts/fonts';

// "שינוי הגדרות הדפסה" ואז החלון: הערך שהחלון קורא מ-sessionStorage, והעובי שיוצא ממנו
const weightAfterReturn = (choice, printType) => {
  saveFontWeightForReturn(choice);
  return resolveFontWeight(sessionStorage.getItem('savedFontWeight'), printType);
};

describe('font weight on returning to the print settings', () => {
  beforeEach(() => sessionStorage.clear());

  test('a default that was only printed is not saved, so switching print type gets its own default', () => {
    expect(weightAfterReturn(null, 'envelopes')).toBe('bold'); // מדבקות (רגיל) ואז מעטפות
    expect(weightAfterReturn(null, 'labels')).toBe('regular'); // מעטפות (מודגש) ואז מדבקות
    expect(sessionStorage.getItem('savedFontWeight')).toBeNull();
  });

  test('an explicit choice is kept across print types', () => {
    expect(weightAfterReturn('regular', 'envelopes')).toBe('regular');
    expect(weightAfterReturn('bold', 'labels')).toBe('bold');
  });

  test('a leftover value from an earlier return is cleared when nothing was chosen', () => {
    sessionStorage.setItem('savedFontWeight', 'regular');
    expect(weightAfterReturn(undefined, 'envelopes')).toBe('bold');
  });
});

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { updateLabelPrintSettings: jest.fn(), updateEnvelopePrintSettings: jest.fn() },
}));

const storedUser = () => JSON.parse(sessionStorage.getItem('user'));

describe('label print settings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('a user who never chose anything gets no saved settings', () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    expect(loadLabelPrintSettings()).toEqual({});
  });

  test('a corrupt saved value is ignored', () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', labelPrintSettings: '{not json' }));
    expect(loadLabelPrintSettings()).toEqual({});
  });

  test('saving sends the choices to the server for this user and remembers them', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', firstNameMan: 'א' }));
    api.updateLabelPrintSettings.mockResolvedValue({ data: {} });

    await saveLabelPrintSettings({ fontWeight: 'bold', fontScale: 110 });

    expect(api.updateLabelPrintSettings).toHaveBeenCalledWith('0501111111', '{"fontWeight":"bold","fontScale":110}');
    expect(loadLabelPrintSettings()).toEqual({ fontWeight: 'bold', fontScale: 110 });
    expect(storedUser().firstNameMan).toBe('א');
  });

  test('saving the same choices again does not call the server', async () => {
    sessionStorage.setItem('user', JSON.stringify({
      phone: '0501111111', labelPrintSettings: '{"fontWeight":"bold"}',
    }));
    await saveLabelPrintSettings({ fontWeight: 'bold' });
    expect(api.updateLabelPrintSettings).not.toHaveBeenCalled();
  });

  test('a late server response does not overwrite a newer choice', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    let resolveFirst;
    api.updateLabelPrintSettings
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: {} });

    const first = saveLabelPrintSettings({ fontWeight: 'regular' });
    await saveLabelPrintSettings({ fontWeight: 'bold' });
    resolveFirst({ data: { phone: '0501111111', labelPrintSettings: '{"fontWeight":"regular"}' } });
    await first;

    expect(loadLabelPrintSettings()).toEqual({ fontWeight: 'bold' });
  });

  test('if the server fails, the choice is still remembered in this session', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    api.updateLabelPrintSettings.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await saveLabelPrintSettings({ fontWeight: 'bold' });

    expect(loadLabelPrintSettings()).toEqual({ fontWeight: 'bold' });
  });

  test('no logged-in user - nothing is sent', async () => {
    await saveLabelPrintSettings({ fontWeight: 'bold' });
    expect(api.updateLabelPrintSettings).not.toHaveBeenCalled();
  });
});

// אותו מנגנון בדיוק, בשדה נפרד ובקריאת שרת נפרדת
describe('envelope print settings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('a user logged in before the field existed, or with a null or corrupt value, gets no saved settings', () => {
    [undefined, null, '{not json', '[1,2]', '"text"'].forEach((value) => {
      sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', envelopePrintSettings: value }));
      expect(loadEnvelopePrintSettings()).toEqual({});
    });
    sessionStorage.removeItem('user');
    expect(loadEnvelopePrintSettings()).toEqual({});
  });

  test('saving goes to the envelope field and call only, and leaves the label choices as they are', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', labelPrintSettings: '{"fontScale":100}' }));
    api.updateEnvelopePrintSettings.mockResolvedValue({ data: {} });

    await saveEnvelopePrintSettings({ fontScale: 130, envelope: { sizeId: 'c6' } });

    expect(api.updateEnvelopePrintSettings).toHaveBeenCalledWith('0501111111', '{"fontScale":130,"envelope":{"sizeId":"c6"}}');
    expect(api.updateLabelPrintSettings).not.toHaveBeenCalled();
    expect(loadEnvelopePrintSettings()).toEqual({ fontScale: 130, envelope: { sizeId: 'c6' } });
    expect(loadLabelPrintSettings()).toEqual({ fontScale: 100 });
  });

  test('saving the same choices again does not call the server', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', envelopePrintSettings: '{"fontWeight":"bold"}' }));
    await saveEnvelopePrintSettings({ fontWeight: 'bold' });
    expect(api.updateEnvelopePrintSettings).not.toHaveBeenCalled();
  });

  test('a late server response does not overwrite a newer choice', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    let resolveFirst;
    api.updateEnvelopePrintSettings
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: {} });

    const first = saveEnvelopePrintSettings({ fontWeight: 'regular' });
    await saveEnvelopePrintSettings({ fontWeight: 'bold' });
    resolveFirst({ data: { phone: '0501111111', envelopePrintSettings: '{"fontWeight":"regular"}' } });
    await first;

    expect(loadEnvelopePrintSettings()).toEqual({ fontWeight: 'bold' });
  });

  test('if the server fails, the choice is still remembered in this session', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    api.updateEnvelopePrintSettings.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await saveEnvelopePrintSettings({ fontWeight: 'bold' });

    expect(loadEnvelopePrintSettings()).toEqual({ fontWeight: 'bold' });
  });

  test('no logged-in user - nothing is sent', async () => {
    await saveEnvelopePrintSettings({ fontWeight: 'bold' });
    expect(api.updateEnvelopePrintSettings).not.toHaveBeenCalled();
  });
});
