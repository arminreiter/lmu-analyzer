import type { RaceFile, CarClass } from './types';

const KEYS = {
  files: 'lmu-analyzer-files',
  selectedDrivers: 'lmu-analyzer-selected-drivers',
  selectedClasses: 'lmu-analyzer-selected-classes',
  activeView: 'lmu-analyzer-active-view',
  dataSource: 'lmu-analyzer-data-source', // 'directory' | 'upload'
  profileName: 'lmu-analyzer-profile-name',
  profileAvatar: 'lmu-analyzer-profile-avatar',
} as const;

const DB_NAME = 'lmu-analyzer';
const DB_STORE = 'handles';
const DB_FILES_STORE = 'files';
const DIR_HANDLE_KEY = 'directory-handle';
const FILES_KEY = 'race-files';

// --- localStorage helpers ---

export function saveFilters(selectedDrivers: string[], selectedClasses: CarClass[], activeView: string) {
  try {
    localStorage.setItem(KEYS.selectedDrivers, JSON.stringify(selectedDrivers));
    localStorage.setItem(KEYS.selectedClasses, JSON.stringify(selectedClasses));
    localStorage.setItem(KEYS.activeView, activeView);
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

export function loadFilters(): { selectedDrivers: string[]; selectedClasses: CarClass[]; activeView: string } | null {
  try {
    const drivers = localStorage.getItem(KEYS.selectedDrivers);
    const classes = localStorage.getItem(KEYS.selectedClasses);
    const view = localStorage.getItem(KEYS.activeView);
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

export async function saveFiles(files: RaceFile[]) {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_FILES_STORE, 'readwrite');
    tx.objectStore(DB_FILES_STORE).put(files, FILES_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    // Clean up old localStorage entry if it exists
    localStorage.removeItem(KEYS.files);
  } catch {
    // IndexedDB unavailable — try localStorage as last resort
    try {
      localStorage.setItem(KEYS.files, JSON.stringify(files));
    } catch {
      // quota exceeded
    }
  }
}

export async function loadFiles(): Promise<RaceFile[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_FILES_STORE, 'readonly');
    const req = tx.objectStore(DB_FILES_STORE).get(FILES_KEY);
    const files = await new Promise<RaceFile[] | null>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (files) return files;
  } catch {
    // IndexedDB unavailable
  }
  // Fallback: try localStorage (migrates old data)
  try {
    const data = localStorage.getItem(KEYS.files);
    if (!data) return null;
    const files = JSON.parse(data) as RaceFile[];
    // Migrate to IndexedDB
    saveFiles(files);
    return files;
  } catch {
    return null;
  }
}

export function saveDataSource(source: 'directory' | 'upload') {
  localStorage.setItem(KEYS.dataSource, source);
}

export function loadDataSource(): 'directory' | 'upload' | null {
  return localStorage.getItem(KEYS.dataSource) as 'directory' | 'upload' | null;
}

export function saveProfileName(name: string) {
  try { localStorage.setItem(KEYS.profileName, name); } catch { /* ignore */ }
}

export function loadProfileName(): string | null {
  return localStorage.getItem(KEYS.profileName);
}

export function saveProfileAvatar(dataUrl: string) {
  try { localStorage.setItem(KEYS.profileAvatar, dataUrl); } catch { /* ignore */ }
}

export function loadProfileAvatar(): string | null {
  return localStorage.getItem(KEYS.profileAvatar);
}

export function clearProfileAvatar() {
  localStorage.removeItem(KEYS.profileAvatar);
}

export async function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  clearDirectoryHandle();
  try {
    const db = await openDB();
    const tx = db.transaction(DB_FILES_STORE, 'readwrite');
    tx.objectStore(DB_FILES_STORE).delete(FILES_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

// --- IndexedDB for FileSystemDirectoryHandle ---

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

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(handle, DIR_HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DIR_HANDLE_KEY);
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(DIR_HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
