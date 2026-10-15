import api from './api';
import {
  getExcelColumns,
  refreshExcelColumns,
  invalidateExcelColumnsCache,
} from './excelColumnsCache';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    getRecipientColumns: jest.fn(),
  },
}));

describe('excel columns cache', () => {
  beforeEach(() => {
    invalidateExcelColumnsCache();
    jest.clearAllMocks();
  });

  it('uses one request until an explicit refresh is requested', async () => {
    api.getRecipientColumns
      .mockResolvedValueOnce({ data: [{ technicalName: 'firstName' }] })
      .mockResolvedValueOnce({ data: [{ technicalName: 'lastName' }] });

    await getExcelColumns();
    await getExcelColumns();
    await expect(refreshExcelColumns()).resolves.toEqual([{ technicalName: 'lastName' }]);

    expect(api.getRecipientColumns).toHaveBeenCalledTimes(2);
  });

  it('after a page refresh, answers from storage immediately and refreshes in the background', async () => {
    api.getRecipientColumns
      .mockResolvedValueOnce({ data: [{ technicalName: 'old' }] })
      .mockResolvedValueOnce({ data: [{ technicalName: 'new' }] });
    await getExcelColumns(); // first load - waits for the server and stores the result

    simulatePageRefresh();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'old' }]);
    expect(api.getRecipientColumns).toHaveBeenCalledTimes(2); // background refresh started

    await flushPromises();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'new' }]);
    expect(JSON.parse(localStorage.getItem('excelColumns'))).toEqual([{ technicalName: 'new' }]);
  });

  it('an explicit invalidate drops the stored copy and waits for the server', async () => {
    api.getRecipientColumns
      .mockResolvedValueOnce({ data: [{ technicalName: 'before' }] })
      .mockResolvedValueOnce({ data: [{ technicalName: 'after' }] });
    await getExcelColumns();

    invalidateExcelColumnsCache();
    expect(localStorage.getItem('excelColumns')).toBeNull();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'after' }]);
  });

  it('a background refresh that finishes after an invalidate does not bring back stale columns', async () => {
    api.getRecipientColumns.mockResolvedValueOnce({ data: [{ technicalName: 'stored' }] });
    await getExcelColumns();
    simulatePageRefresh();

    let resolveStale;
    api.getRecipientColumns
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }))
      .mockResolvedValueOnce({ data: [{ technicalName: 'with-new-alias' }] });

    await getExcelColumns(); // answers from storage, background request still pending
    // a new alias is saved meanwhile -> explicit refresh
    await expect(refreshExcelColumns()).resolves.toEqual([{ technicalName: 'with-new-alias' }]);

    resolveStale({ data: [{ technicalName: 'stale' }] });
    await flushPromises();

    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'with-new-alias' }]);
    expect(JSON.parse(localStorage.getItem('excelColumns'))).toEqual([{ technicalName: 'with-new-alias' }]);
  });

  it('a failed background refresh keeps the stored columns', async () => {
    api.getRecipientColumns
      .mockResolvedValueOnce({ data: [{ technicalName: 'kept' }] })
      .mockRejectedValueOnce(new Error('offline'));
    await getExcelColumns();

    simulatePageRefresh();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'kept' }]);
    await flushPromises();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'kept' }]);
  });
});

// A refresh wipes the module's in-memory cache but keeps localStorage
function simulatePageRefresh() {
  const stored = localStorage.getItem('excelColumns');
  invalidateExcelColumnsCache();
  localStorage.setItem('excelColumns', stored);
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
