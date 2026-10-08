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
});
