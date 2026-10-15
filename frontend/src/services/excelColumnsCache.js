import api from "./api";

// The column definitions also live in localStorage, so a page refresh (which
// wipes the in-memory cache) can render the table immediately instead of
// waiting for the server. They rarely change; a background request still
// refreshes them on every page load.
const STORAGE_KEY = 'excelColumns';

let cachedColumnsPromise = null;

function readStoredColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Storage blocked (private mode) or corrupt value - just use the server.
    return null;
  }
}

function writeStoredColumns(columns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Not critical - the next page load simply waits for the server again.
  }
}

function fetchColumnsFromServer() {
  return api
      .getRecipientColumns()
      .then((res) => {
        writeStoredColumns(res.data);
        return res.data;
      });
}

export function getExcelColumns() {
  if (!cachedColumnsPromise) {
    const stored = readStoredColumns();
    if (stored) {
      // Answer from storage right away; when the server responds, later
      // callers (e.g. the next Excel import) get the fresh definitions.
      cachedColumnsPromise = Promise.resolve(stored);
      fetchColumnsFromServer()
          .then((fresh) => {
            cachedColumnsPromise = Promise.resolve(fresh);
          })
          .catch(() => {});
    } else {
      cachedColumnsPromise = fetchColumnsFromServer().catch((error) => {
        // Do not keep a rejected request in the cache. A later login or
        // screen load can retry instead of being permanently blocked.
        cachedColumnsPromise = null;
        throw error;
      });
    }
  }
  return cachedColumnsPromise;
}

export function refreshExcelColumns() {
  invalidateExcelColumnsCache();
  return getExcelColumns();
}

// Also drops the stored copy: an explicit invalidate (new alias saved, login,
// preferences changed) must wait for the server, not answer with stale data.
export function invalidateExcelColumnsCache() {
  cachedColumnsPromise = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore - see readStoredColumns
  }
}
