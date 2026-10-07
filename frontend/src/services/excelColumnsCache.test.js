import api from './api';
import {
  getExcelColumns,
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

  it('loads the column definitions once and reuses the same request result', async () => {
    const columns = [{ technicalName: 'lastName' }];
    api.getRecipientColumns.mockResolvedValue({ data: columns });

    await expect(getExcelColumns()).resolves.toEqual(columns);
    await expect(getExcelColumns()).resolves.toEqual(columns);

    expect(api.getRecipientColumns).toHaveBeenCalledTimes(1);
  });

  it('loads fresh definitions after cache invalidation', async () => {
    api.getRecipientColumns
      .mockResolvedValueOnce({ data: [{ technicalName: 'firstName' }] })
      .mockResolvedValueOnce({ data: [{ technicalName: 'lastName' }] });

    await getExcelColumns();
    invalidateExcelColumnsCache();
    await expect(getExcelColumns()).resolves.toEqual([{ technicalName: 'lastName' }]);

    expect(api.getRecipientColumns).toHaveBeenCalledTimes(2);
  });
});
