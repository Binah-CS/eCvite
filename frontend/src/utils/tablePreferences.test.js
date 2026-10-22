import api from '../services/api';
import { loadTablePreferences, saveTablePreferences } from './tablePreferences';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { updateTablePreferences: jest.fn() },
}));

const storedUser = () => JSON.parse(sessionStorage.getItem('user'));

describe('table preferences', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('a user who never chose anything gets no saved preferences', () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    expect(loadTablePreferences()).toEqual({});
  });

  test('the choice saved on the server comes with the user on login', () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', tablePreferences: '{"pageSize":100}' }));
    expect(loadTablePreferences()).toEqual({ pageSize: 100 });
  });

  test('a corrupt saved value is ignored', () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', tablePreferences: '{not json' }));
    expect(loadTablePreferences()).toEqual({});
  });

  test('saving sends the choice to the server for this user and remembers it in the session', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', firstNameMan: 'א' }));
    api.updateTablePreferences.mockResolvedValue({ data: {} });

    await saveTablePreferences({ pageSize: 50 });

    expect(api.updateTablePreferences).toHaveBeenCalledWith('0501111111', '{"pageSize":50}');
    expect(loadTablePreferences()).toEqual({ pageSize: 50 });
    expect(storedUser().firstNameMan).toBe('א');
  });

  test('saving one preference keeps the others', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', tablePreferences: '{"pageSize":50,"other":1}' }));
    api.updateTablePreferences.mockResolvedValue({ data: {} });

    await saveTablePreferences({ pageSize: 100 });

    expect(loadTablePreferences()).toEqual({ pageSize: 100, other: 1 });
  });

  test('saving the same choice again does not call the server', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111', tablePreferences: '{"pageSize":50}' }));
    await saveTablePreferences({ pageSize: 50 });
    expect(api.updateTablePreferences).not.toHaveBeenCalled();
  });

  test('a late server response does not overwrite a newer choice', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    let resolveFirst;
    api.updateTablePreferences
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: {} });

    const first = saveTablePreferences({ pageSize: 50 });
    await saveTablePreferences({ pageSize: 100 });
    resolveFirst({ data: { phone: '0501111111', tablePreferences: '{"pageSize":50}' } });
    await first;

    expect(loadTablePreferences()).toEqual({ pageSize: 100 });
  });

  test('if the server fails, the choice is still remembered in this session', async () => {
    sessionStorage.setItem('user', JSON.stringify({ phone: '0501111111' }));
    api.updateTablePreferences.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await saveTablePreferences({ pageSize: 100 });

    expect(loadTablePreferences()).toEqual({ pageSize: 100 });
  });

  test('no logged-in user - nothing is sent', async () => {
    await saveTablePreferences({ pageSize: 100 });
    expect(api.updateTablePreferences).not.toHaveBeenCalled();
  });
});
