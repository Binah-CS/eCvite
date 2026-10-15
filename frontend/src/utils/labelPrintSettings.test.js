import api from '../services/api';
import { loadLabelPrintSettings, saveLabelPrintSettings } from './labelPrintSettings';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { updateLabelPrintSettings: jest.fn() },
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
