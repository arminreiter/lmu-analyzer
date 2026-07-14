import type { RaceFile, CarClass } from './types';

/** All localStorage keys used by the app. Register new keys here. */
export const KEYS = {
  files: 'lmu-analyzer-files',
  selectedDrivers: 'lmu-analyzer-selected-drivers',
  selectedClasses: 'lmu-analyzer-selected-classes',
  activeView: 'lmu-analyzer-active-view',
  dataSource: 'lmu-analyzer-data-source', // 'directory' | 'upload'
  profileName: 'lmu-analyzer-profile-name',
  profileAvatar: 'lmu-analyzer-profile-avatar',
  profileSettings: 'lmu-analyzer-profile-settings',
  benchmarks: 'lmu-analyzer-benchmarks',
  theme: 'lmu-analyzer-theme',
  trackModeSelected: 'lmu_trackmode_selected', // legacy name — renaming would lose users' stored value
} as const;

// Bump when the cached RaceFile shape changes — mismatched (or unversioned) caches are discarded.
const CACHE_VERSION = 1;

const DB_NAME = 'lmu-analyzer';
const DB_STORE = 'handles';
const DB_FILES_STORE = 'files';
const DIR_HANDLE_KEY = 'directory-handle';
const FILES_KEY = 'race-files';

// --- localStorage helpers (Safari lockdown / quota can throw on any access) ---

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or unavailable */ }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* unavailable */ }
}

export function saveFilters(selectedDrivers: string[], selectedClasses: CarClass[], activeView: string) {
  lsSet(KEYS.selectedDrivers, JSON.stringify(selectedDrivers));
  lsSet(KEYS.selectedClasses, JSON.stringify(selectedClasses));
  lsSet(KEYS.activeView, activeView);
}

export function loadFilters(): { selectedDrivers: string[]; selectedClasses: CarClass[]; activeView: string } | null {
  try {
    const drivers = lsGet(KEYS.selectedDrivers);
    const classes = lsGet(KEYS.selectedClasses);
    const view = lsGet(KEYS.activeView);
    if (!drivers && !classes && !view) return null;
    return {
      selectedDrivers: drivers ? JSON.parse(drivers) : [],
      selectedClasses: classes ? JSON.parse(classes) : [],
      activeView: view || 'overview',
    };
  } catch {
    return null;
  }
}

interface FilesCache {
  version: number;
  files: RaceFile[];
}

/**
 * Persist parsed files for later resume.
 * Returns false when neither IndexedDB nor localStorage could store them.
 */
export async function saveFiles(files: RaceFile[]): Promise<boolean> {
  const cache: FilesCache = { version: CACHE_VERSION, files };
  try {
    await idbPut(DB_FILES_STORE, FILES_KEY, cache);
    // Clean up old localStorage entry if it exists
    lsRemove(KEYS.files);
    return true;
  } catch {
    // IndexedDB unavailable — try localStorage as last resort
    try {
      localStorage.setItem(KEYS.files, JSON.stringify(cache));
      return true;
    } catch {
      return false; // quota exceeded
    }
  }
}

function unwrapCache(raw: unknown): RaceFile[] | null {
  // Unversioned caches (plain arrays from older app versions) are discarded
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cache = raw as FilesCache;
  if (cache.version !== CACHE_VERSION || !Array.isArray(cache.files)) return null;
  return cache.files;
}

export async function loadCachedFiles(): Promise<RaceFile[] | null> {
  try {
    const raw = await idbGet(DB_FILES_STORE, FILES_KEY);
    const files = unwrapCache(raw);
    if (files) return files;
  } catch {
    // IndexedDB unavailable
  }
  // Fallback: try localStorage (migrates old data)
  try {
    const data = lsGet(KEYS.files);
    if (!data) return null;
    // Cast is safe: the version check above guarantees we wrote this shape ourselves
    const files = unwrapCache(JSON.parse(data));
    if (!files) return null;
    // Migrate to IndexedDB
    saveFiles(files);
    return files;
  } catch {
    return null;
  }
}

export function saveDataSource(source: 'directory' | 'upload') {
  lsSet(KEYS.dataSource, source);
}

export function loadDataSource(): 'directory' | 'upload' | null {
  return lsGet(KEYS.dataSource) as 'directory' | 'upload' | null;
}

export function saveProfileName(name: string) {
  lsSet(KEYS.profileName, name);
}

export function loadProfileName(): string | null {
  return lsGet(KEYS.profileName);
}

export function saveProfileAvatar(dataUrl: string) {
  lsSet(KEYS.profileAvatar, dataUrl);
}

export function loadProfileAvatar(): string | null {
  return lsGet(KEYS.profileAvatar);
}

export function clearProfileAvatar() {
  lsRemove(KEYS.profileAvatar);
}

// Keys that survive a data reload: theme and profile are user identity/preference,
// everything else (files, filters, benchmarks toggle, track-mode selection) is data-related.
const KEEP_ON_CLEAR: ReadonlySet<string> = new Set([
  KEYS.theme, KEYS.profileName, KEYS.profileAvatar, KEYS.profileSettings,
]);

export async function clearAll() {
  Object.values(KEYS).forEach(k => { if (!KEEP_ON_CLEAR.has(k)) lsRemove(k); });
  clearDirectoryHandle();
  try {
    await idbDelete(DB_FILES_STORE, FILES_KEY);
  } catch {
    // ignore
  }
}

// --- IndexedDB helpers ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(DB_FILES_STORE)) {
        db.createObjectStore(DB_FILES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Run one operation in its own transaction and await completion */
async function idbOp<T>(
  store: string,
  mode: IDBTransactionMode,
  op: (os: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  try {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    return await new Promise<T>((resolve, reject) => {
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function idbPut(store: string, key: string, value: unknown): Promise<IDBValidKey> {
  return idbOp(store, 'readwrite', os => os.put(value, key));
}

async function idbGet(store: string, key: string): Promise<unknown> {
  return (await idbOp(store, 'readonly', os => os.get(key))) ?? null;
}

function idbDelete(store: string, key: string): Promise<undefined> {
  return idbOp(store, 'readwrite', os => os.delete(key));
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  try {
    await idbPut(DB_STORE, DIR_HANDLE_KEY, handle);
  } catch {
    // IndexedDB unavailable
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await idbGet(DB_STORE, DIR_HANDLE_KEY)) as FileSystemDirectoryHandle | null) ?? null;
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle() {
  try {
    await idbDelete(DB_STORE, DIR_HANDLE_KEY);
  } catch {
    // ignore
  }
}
