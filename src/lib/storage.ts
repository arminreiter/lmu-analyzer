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

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or unavailable */ }
}

export function lsRemove(key: string): void {
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

interface CachedFiles {
  files: RaceFile[];
  /** True when the cache was written by an app version predating the versioned format. */
  legacy: boolean;
}

function unwrapCache(raw: unknown): CachedFiles | null {
  // Legacy caches were a plain RaceFile[] with the same shape as version 1 — accept them;
  // loadCachedFiles rewrites them in versioned form and flags them to the caller.
  // ponytail: valid only while CACHE_VERSION === 1; on the first version bump, discard plain arrays instead.
  if (Array.isArray(raw)) return { files: raw as RaceFile[], legacy: true };
  if (!raw || typeof raw !== 'object') return null;
  const cache = raw as FilesCache;
  if (cache.version !== CACHE_VERSION || !Array.isArray(cache.files)) return null;
  return { files: cache.files, legacy: false };
}

export async function loadCachedFiles(): Promise<CachedFiles | null> {
  try {
    const raw = await idbGet(DB_FILES_STORE, FILES_KEY);
    const cached = unwrapCache(raw);
    if (cached) {
      // Rewrite legacy caches in versioned form so a future version bump doesn't discard them
      if (cached.legacy) void saveFiles(cached.files);
      return cached;
    }
  } catch {
    // IndexedDB unavailable
  }
  // Fallback: try localStorage (migrates old data to IndexedDB)
  try {
    const data = lsGet(KEYS.files);
    if (!data) return null;
    const cached = unwrapCache(JSON.parse(data));
    if (!cached) return null;
    saveFiles(cached.files);
    return cached;
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

// Only the theme survives a data reload (pure UI preference); everything else —
// files, filters, profile, benchmarks toggle, track-mode selection — is wiped.
const KEEP_ON_CLEAR: ReadonlySet<string> = new Set([KEYS.theme]);

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
