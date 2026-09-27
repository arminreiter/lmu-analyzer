import { sendNotification } from '@tauri-apps/plugin-notification';
import { detectPlayerDrivers, getPersonalBests } from './analytics';
import { formatDelta, formatLapTime } from './formatting';
import type { RaceFile } from './types';

const pbKey = (pb: { trackCourse: string; carType: string }) => `${pb.trackCourse}|${pb.carType}`;

/** Messages for files in `next` that weren't in `prev`: one per new PB, else one per new session. */
export function newSessionMessages(prev: RaceFile[], next: RaceFile[]): string[] {
  const known = new Set(prev.map(f => f.fileName));
  const fresh = next.filter(f => !known.has(f.fileName));
  if (fresh.length === 0) return [];

  const drivers = detectPlayerDrivers(next);
  const oldBests = new Map(getPersonalBests(prev, drivers).map(pb => [pbKey(pb), pb.lapTime]));
  const newPbs = getPersonalBests(next, drivers).filter(pb => !known.has(pb.fileName));
  if (newPbs.length > 0) {
    return newPbs.map(pb => {
      const old = oldBests.get(pbKey(pb));
      const delta = old ? ` (${formatDelta(pb.lapTime - old)})` : '';
      return `New PB · ${pb.trackCourse} · ${pb.carType}: ${formatLapTime(pb.lapTime)}${delta}`;
    });
  }
  return fresh.map(f => `New session · ${f.trackCourse}`);
}

export function notifyNewSessions(prev: RaceFile[], next: RaceFile[]) {
  for (const body of newSessionMessages(prev, next)) {
    sendNotification({ title: 'LMU Analyzer', body });
  }
}
