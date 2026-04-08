import type { RaceFile, CarClass } from './types';

const KEYS = {
  files: 'lmu-analyzer-files',
  selectedDrivers: 'lmu-analyzer-selected-drivers',
  selectedClasses: 'lmu-analyzer-selected-classes',
  activeView: 'lmu-analyzer-active-view',
  dataSource: 'lmu-analyzer-data-source', // 'directory' | 'upload'
} as const;

const DB_NAME = 'lmu-analyzer';
const DB_STORE = 'handles';
const DIR_HANDLE_KEY = 'directory-handle';

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

export function saveFiles(files: RaceFile[]) {
  try {
    localStorage.setItem(KEYS.files, JSON.stringify(files));
  } catch {
    // data too large — silently ignore
  }
}

export function loadFiles(): RaceFile[] | null {
  try {
    const data = localStorage.getItem(KEYS.files);
    if (!data) return null;
    return JSON.parse(data);
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

export function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  clearDirectoryHandle();
}

// --- IndexedDB for FileSystemDirectoryHandle ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
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
