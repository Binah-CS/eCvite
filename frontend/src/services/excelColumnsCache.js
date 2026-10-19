import api from "./api";

let cachedColumnsPromise = null;

export function getExcelColumns() {
  if (!cachedColumnsPromise) {
    cachedColumnsPromise = api
        .getRecipientColumns()
        .then((res) => res.data)
        .catch((error) => {
          // Do not keep a rejected request in the cache. A later login or
          // screen load can retry instead of being permanently blocked.
          cachedColumnsPromise = null;
          throw error;
        });
  }
  return cachedColumnsPromise;
}

export function refreshExcelColumns() {
  invalidateExcelColumnsCache();
  return getExcelColumns();
}

export function invalidateExcelColumnsCache() {
  cachedColumnsPromise = null;
}
