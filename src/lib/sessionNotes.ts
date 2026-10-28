import { useCallback, useState } from 'react';
import { KEYS, lsGet, lsSet } from './storage';

export interface SessionNote {
  note: string;
  tags: string[];
}

/** Keyed by sessionKey() */
export type SessionNotes = Record<string, SessionNote>;

const isNote = (n: unknown): n is SessionNote => {
  const note = n as SessionNote;
  return typeof note?.note === 'string' && Array.isArray(note.tags) && note.tags.every(t => typeof t === 'string');
};

/** Stored notes, keeping only well-formed entries — a bad value (e.g. from a backup) must not crash the views */
function loadNotes(): SessionNotes {
  try {
    const parsed: unknown = JSON.parse(lsGet(KEYS.sessionNotes) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter((entry): entry is [string, SessionNote] => isNote(entry[1]))
      .map(([key, n]) => [key, { note: n.note, tags: [...new Set(n.tags)] }]));
  } catch {
    return {};
  }
}

/**
 * Notes and tags per session, in localStorage. `save` writes storage directly (not inside a state
 * updater) so a save from an unmounting component still lands; false = storage full/unavailable.
 */
export type NoteUpdate = (current: SessionNote) => SessionNote;

export function useSessionNotes(): [SessionNotes, (key: string, update: NoteUpdate) => boolean] {
  const [notes, setNotes] = useState(loadNotes);
  // An update applied to what's stored now, so a change made in another tab isn't overwritten
  const save = useCallback((key: string, update: NoteUpdate) => {
    const next = loadNotes();
    const value = update(next[key] ?? { note: '', tags: [] });
    if (value.note.trim() === '' && value.tags.length === 0) delete next[key];
    else next[key] = value;
    const ok = lsSet(KEYS.sessionNotes, JSON.stringify(next));
    if (ok) setNotes(next);
    return ok;
  }, []);
  return [notes, save];
}

export function allTags(notes: SessionNotes): string[] {
  return Array.from(new Set(Object.values(notes).flatMap(n => n.tags))).sort((a, b) => a.localeCompare(b));
}
