import { compress, decompress, downloadBlob } from './download';
import { KEYS, clearDirectoryHandle, loadCachedFiles, lsGet, lsSet, saveDataSource, saveFiles } from './storage';
import type { RaceFile } from './types';

const APP = 'lmu-analyzer-backup';

interface Backup {
  app: typeof APP;
  version: 1;
  exportedAt: string;
  files: RaceFile[];
  /** localStorage values by KEYS name: notes, excluded sessions, profile, filters, ... */
  settings: Record<string, string>;
}

// Where the data came from belongs to this machine, not the backup
const SKIP: ReadonlySet<string> = new Set([KEYS.files, KEYS.dataSource]);

/** Download all parsed results plus settings and notes as one gzipped JSON file */
export async function exportBackup(): Promise<void> {
  const cached = await loadCachedFiles();
  const settings: Record<string, string> = {};
  for (const [name, key] of Object.entries(KEYS)) {
    const value = lsGet(key);
    if (value !== null && !SKIP.has(key)) settings[name] = value;
  }
  const backup: Backup = { app: APP, version: 1, exportedAt: new Date().toISOString(), files: cached?.files ?? [], settings };
  const bytes = await compress(JSON.stringify(backup));
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/gzip' }), `lmu-analyzer-backup-${backup.exportedAt.slice(0, 10)}.json.gz`);
}

/**
 * Restore a backup: replaces the cached results and the stored settings it contains.
 * The caller reloads the page so the app starts from the restored state.
 */
export async function importBackup(file: File): Promise<{ files: number }> {
  // Accept both the gzipped export and a hand-unzipped .json
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const text = head[0] === 0x1f && head[1] === 0x8b ? await decompress(file) : await file.text();
  const backup = JSON.parse(text) as Backup;
  if (backup?.app !== APP || backup.version !== 1 || !Array.isArray(backup.files)) {
    throw new Error('This is not an LMU Analyzer backup file.');
  }
  // What gets stored is rendered on every later start — reject anything that isn't shaped like parsed results
  if (!backup.files.every(looksLikeRaceFile)) throw new Error('This backup file is damaged.');
  if (!(await saveFiles(backup.files))) throw new Error('Not enough browser storage to restore this backup.');
  const keys = KEYS as Record<string, string>;
  for (const [name, value] of Object.entries(backup.settings ?? {})) {
    // Only keys this app knows, and only string values
    if (keys[name] && !SKIP.has(keys[name]) && typeof value === 'string') lsSet(keys[name], value);
  }
  // Detach the results folder: re-reading it on the next start would replace the restored results
  saveDataSource('upload');
  await clearDirectoryHandle();
  return { files: backup.files.length };
}

function looksLikeRaceFile(value: unknown): boolean {
  const f = value as RaceFile;
  const arr = Array.isArray;
  return typeof f?.fileName === 'string' && typeof f.trackCourse === 'string' && arr(f.sessions) && f.sessions.every(s =>
    arr(s?.drivers) && arr(s.incidents) && arr(s.penalties) && arr(s.trackLimits)
    && s.drivers.every(d => typeof d?.name === 'string' && arr(d.laps)));
}
