import type { RaceFile, PersonalBest, DriverSummary, DriverResult, LapData, SessionData, CarClass } from './types';

/** Car classes ordered by speed (fastest first) */
export const CLASS_SPEED_ORDER: CarClass[] = ['Hyper', 'LMP3', 'GTE', 'GT3'];

// ---------------------------------------------------------------------------
// Session deduplication / merging
// ---------------------------------------------------------------------------

function mergeDriverResult(entries: DriverResult[]): DriverResult {
  // Pick the entry with the best finish as the base for metadata
  const sorted = [...entries].sort((a, b) => {
    const aOk = a.finishStatus === 'Finished Normally' || a.finishStatus === '' || a.finishStatus === 'None';
    const bOk = b.finishStatus === 'Finished Normally' || b.finishStatus === '' || b.finishStatus === 'None';
    if (aOk !== bOk) return aOk ? -1 : 1;
    return b.totalLaps - a.totalLaps;
  });
  const base = { ...sorted[0] };

  // Merge laps: union by lap number, keep the first occurrence
  const lapMap = new Map<number, LapData>();
  for (const entry of entries) {
    for (const lap of entry.laps) {
      if (!lapMap.has(lap.num)) lapMap.set(lap.num, lap);
    }
  }
  base.laps = Array.from(lapMap.values()).sort((a, b) => a.num - b.num);
  base.totalLaps = Math.max(base.totalLaps, base.laps.length);

  // Recalculate best lap from merged data
  let best: number | null = null;
  for (const lap of base.laps) {
    if (lap.lapTime && lap.lapTime > 0 && (best === null || lap.lapTime < best)) {
      best = lap.lapTime;
    }
  }
  base.bestLapTime = best;
  return base;
}

function mergeSessions(sessions: SessionData[]): SessionData {
  // Use the most complete session as the base
  const sorted = [...sessions].sort((a, b) => b.mostLapsCompleted - a.mostLapsCompleted);
  const base = { ...sorted[0] };

  // Merge all drivers across session duplicates
  const driverMap = new Map<string, DriverResult[]>();
  for (const s of sessions) {
    for (const d of s.drivers) {
      const list = driverMap.get(d.name);
      if (list) list.push(d);
      else driverMap.set(d.name, [d]);
    }
  }
  base.drivers = Array.from(driverMap.values()).map(list =>
    list.length === 1 ? list[0] : mergeDriverResult(list),
  );

  // Merge stream events — deduplicate by time + description
  const incidentKeys = new Set<string>();
  base.incidents = [];
  for (const s of sessions) {
    for (const inc of s.incidents) {
      const key = `${inc.time.toFixed(1)}|${inc.description}`;
      if (!incidentKeys.has(key)) { incidentKeys.add(key); base.incidents.push(inc); }
    }
  }
  const penaltyKeys = new Set<string>();
  base.penalties = [];
  for (const s of sessions) {
    for (const pen of s.penalties) {
      const key = `${pen.time.toFixed(1)}|${pen.driver}|${pen.type}`;
      if (!penaltyKeys.has(key)) { penaltyKeys.add(key); base.penalties.push(pen); }
    }
  }
  const tlKeys = new Set<string>();
  base.trackLimits = [];
  for (const s of sessions) {
    for (const tl of s.trackLimits) {
      const key = `${tl.time.toFixed(1)}|${tl.driver}|${tl.lap}`;
      if (!tlKeys.has(key)) { tlKeys.add(key); base.trackLimits.push(tl); }
    }
  }

  return base;
}

/**
 * Merges rejoin fragments: when LMU writes multiple XML files for the same
 * server session (same timeString + trackCourse + session type), combine them
 * into a single session with merged laps, drivers, and stream events.
 */
export function deduplicateSessions(files: RaceFile[]): RaceFile[] {
  interface SessionRef { fileIdx: number; sessionIdx: number }

  // Group sessions by server identity: timeString + trackCourse + type
  const groups = new Map<string, SessionRef[]>();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    for (let si = 0; si < file.sessions.length; si++) {
      const sess = file.sessions[si];
      const key = file.timeString
        ? `${file.timeString}|${file.trackCourse}|${sess.type}`
        : `__ungrouped_${fi}_${si}`;
      const group = groups.get(key);
      if (group) group.push({ fileIdx: fi, sessionIdx: si });
      else groups.set(key, [{ fileIdx: fi, sessionIdx: si }]);
    }
  }

  // Nothing to merge
  if ([...groups.values()].every(g => g.length === 1)) return files;

  // Track which sessions to remove after merging
  const removeSet = new Set<string>();

  const cloned: RaceFile[] = files.map(f => ({ ...f, sessions: [...f.sessions] }));

  for (const group of groups.values()) {
    if (group.length === 1) continue;
    const sessions = group.map(r => cloned[r.fileIdx].sessions[r.sessionIdx]);
    cloned[group[0].fileIdx].sessions[group[0].sessionIdx] = mergeSessions(sessions);
    for (let k = 1; k < group.length; k++) {
      removeSet.add(`${group[k].fileIdx}_${group[k].sessionIdx}`);
    }
  }

  return cloned
    .map((f, fi) => ({
      ...f,
      sessions: f.sessions.filter((_, si) => !removeSet.has(`${fi}_${si}`)),
    }))
    .filter(f => f.sessions.length > 0);
}

/** Normalize driver name(s) to always be an array */
function asArray(driverNames: string | string[]): string[] {
  return Array.isArray(driverNames) ? driverNames : [driverNames];
}

/** Build a PersonalBest record from file/session/driver/lap context */
function toLapRecord(file: RaceFile, session: SessionData, driver: DriverResult, lap: LapData): PersonalBest {
  return {
    lapTime: lap.lapTime!,
    sector1: lap.sector1,
    sector2: lap.sector2,
    sector3: lap.sector3,
    topSpeed: lap.topSpeed,
    trackVenue: file.trackVenue,
    trackCourse: file.trackCourse,
    carType: driver.carType,
    carClass: driver.carClass,
    sessionType: session.type,
    sessionIndex: session.sessionIndex,
    date: file.timeString,
    fileName: file.fileName,
    lapNumber: lap.num,
    driverName: driver.name,
  };
}

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsStr = secs.toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${secsStr}` : secsStr;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

export function formatEventTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export function getChartTooltipStyle() {
  const isLight = document.documentElement.classList.contains('light');
  return {
    background: isLight ? '#ffffff' : '#1a1a24',
    border: isLight ? '1px solid #d1d5db' : '1px solid #2a2a3a',
    borderRadius: 8,
    fontSize: 12,
    color: isLight ? '#1f2937' : '#e5e7eb',
  };
}
export function formatSector(v: number | null): string {
  if (v === null) return '--';
  return v.toFixed(3);
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(0)} km/h`;
}

export function formatDistance(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

/** Consistency score (0-100%) based on coefficient of variation of valid lap times */
export function calculateConsistency(laps: LapData[]): number | null {
  const times = laps.filter(l => l.lapTime && l.lapTime > 0).map(l => l.lapTime!);
  if (times.length < 2) return null;
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const std = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  return 100 - (std / avg) * 100;
}

/** Highest top speed from a set of laps, or null if none recorded */
export function getTopSpeed(laps: LapData[]): number | null {
  const speeds = laps.map(l => l.topSpeed).filter(s => s > 0);
  return speeds.length ? Math.max(...speeds) : null;
}

export function isDriverIncident(incident: { driver1: string; description: string }, driverName: string): boolean {
  return incident.driver1 === driverName || incident.description.includes(driverName);
}

export function getClassColor(carClass: CarClass): string {
  switch (carClass) {
    case 'Hyper': return 'var(--color-hyper)';
    case 'GT3': return 'var(--color-gt3)';
    case 'GTE': return 'var(--color-gte)';
    case 'LMP3': return 'var(--color-lmp3)';
    default: return 'var(--color-racing-muted)';
  }
}

export function isRatedRace(file: RaceFile): boolean {
  return file.setting === 'Multiplayer' && file.freeSettings !== 2147483647;
}

export function getAllClasses(files: RaceFile[]): CarClass[] {
  const classes = new Set<CarClass>();
  for (const file of files) {
    for (const session of file.sessions) {
      for (const driver of session.drivers) {
        if (driver.carClass !== 'Unknown') classes.add(driver.carClass);
      }
    }
  }
  return CLASS_SPEED_ORDER.filter(c => classes.has(c));
}

export function filterFilesByClasses(files: RaceFile[], classes: CarClass[]): RaceFile[] {
  if (classes.length === 0) return files;
  return files.map(file => ({
    ...file,
    sessions: file.sessions.map(session => ({
      ...session,
      drivers: session.drivers.filter(d => classes.includes(d.carClass)),
    })).filter(s => s.drivers.length > 0),
  })).filter(f => f.sessions.length > 0);
}

export function getAllDrivers(files: RaceFile[]): DriverSummary[] {
  const map = new Map<string, DriverSummary>();

  for (const file of files) {
    for (const session of file.sessions) {
      for (const driver of session.drivers) {
        const existing = map.get(driver.name);
        if (existing) {
          existing.sessionCount++;
          existing.totalLaps += driver.totalLaps;
          if (driver.isPlayer) existing.isPlayer = true;
        } else {
          map.set(driver.name, {
            name: driver.name,
            sessionCount: 1,
            totalLaps: driver.totalLaps,
            isPlayer: driver.isPlayer,
          });
        }
      }
    }
  }

  const drivers = Array.from(map.values());
  drivers.sort((a, b) => {
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return b.sessionCount - a.sessionCount;
  });
  return drivers;
}

export function detectPlayerDrivers(files: RaceFile[]): string[] {
  // In multiplayer sessions, ALL human players have isPlayer=1.
  // To find the local user, look at sessions where exactly 1 driver has isPlayer=1
  // (single-player / AI races) — those names are the local user's profiles.
  const localNames = new Set<string>();

  for (const file of files) {
    for (const session of file.sessions) {
      const players = session.drivers.filter(d => d.isPlayer);
      if (players.length === 1) {
        localNames.add(players[0].name);
      }
    }
  }

  // Also check small multiplayer sessions (2-3 players) where one name is already known —
  // the other known-prefix names might be alternate profiles of the same local user.
  if (localNames.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const file of files) {
        for (const session of file.sessions) {
          const players = session.drivers.filter(d => d.isPlayer);
          if (players.length >= 2 && players.length <= 3) {
            const hasKnown = players.some(p => {
              if (localNames.has(p.name)) return true;
              const firstName = p.name.split(/\s+/)[0].toLowerCase();
              for (const known of localNames) {
                if (known.toLowerCase().startsWith(firstName) || firstName.startsWith(known.split(/\s+/)[0].toLowerCase())) {
                  return true;
                }
              }
              return false;
            });
            if (hasKnown) {
              for (const p of players) {
                // Add co-players from small sessions if they share a name prefix with a known name
                if (!localNames.has(p.name)) {
                  const firstName = p.name.split(/\s+/)[0].toLowerCase();
                  for (const known of localNames) {
                    if (known.toLowerCase().startsWith(firstName) || firstName.startsWith(known.split(/\s+/)[0].toLowerCase())) {
                      localNames.add(p.name);
                      changed = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (localNames.size > 0) return Array.from(localNames);

  // Fallback: no single-player sessions found, return the most frequent player
  const drivers = getAllDrivers(files);
  const players = drivers.filter(d => d.isPlayer);
  if (players.length === 0) return drivers[0] ? [drivers[0].name] : [];
  return [players[0].name];
}

export function getDriverSessions(
  files: RaceFile[],
  driverNames: string | string[]
): Array<{ file: RaceFile; session: SessionData; driver: DriverResult }> {
  const names = asArray(driverNames);
  const results: Array<{ file: RaceFile; session: SessionData; driver: DriverResult }> = [];
  for (const file of files) {
    for (const session of file.sessions) {
      for (const name of names) {
        const driver = session.drivers.find(d => d.name === name);
        if (driver) {
          results.push({ file, session, driver });
        }
      }
    }
  }
  return results;
}

export function getPersonalBests(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const names = asArray(driverNames);
  const bests = new Map<string, PersonalBest>();

  for (const file of files) {
    for (const session of file.sessions) {
      const drivers = session.drivers.filter(d => names.includes(d.name));
      for (const driver of drivers) {
        for (const lap of driver.laps) {
          if (!lap.lapTime || lap.lapTime <= 0) continue;

          const key = `${file.trackCourse}|${driver.carType}`;
          const existing = bests.get(key);

          if (!existing || lap.lapTime < existing.lapTime) {
            bests.set(key, toLapRecord(file, session, driver, lap));
          }
        }
      }
    }
  }

  const result = Array.from(bests.values());
  result.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return result;
}

export function getAllSessionBests(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const names = asArray(driverNames);
  const results: PersonalBest[] = [];

  for (const file of files) {
    for (const session of file.sessions) {
      const drivers = session.drivers.filter(d => names.includes(d.name));
      for (const driver of drivers) {
        let best: { lap: typeof driver.laps[0] } | null = null;
        for (const lap of driver.laps) {
          if (!lap.lapTime || lap.lapTime <= 0) continue;
          if (!best || lap.lapTime < best.lap.lapTime!) best = { lap };
        }
        if (best) {
          results.push(toLapRecord(file, session, driver, best.lap));
        }
      }
    }
  }

  results.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return results;
}

export function getAllLaps(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const names = asArray(driverNames);
  const results: PersonalBest[] = [];

  for (const file of files) {
    for (const session of file.sessions) {
      const drivers = session.drivers.filter(d => names.includes(d.name));
      for (const driver of drivers) {
        for (const lap of driver.laps) {
          if (!lap.lapTime || lap.lapTime <= 0) continue;
          results.push(toLapRecord(file, session, driver, lap));
        }
      }
    }
  }

  results.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return results;
}

export function getTheoreticalBest(files: RaceFile[], driverNames: string | string[], trackCourse: string, carType: string): {
  s1: number | null; s2: number | null; s3: number | null; total: number | null;
} {
  const names = asArray(driverNames);
  let bestS1: number | null = null;
  let bestS2: number | null = null;
  let bestS3: number | null = null;

  for (const file of files) {
    if (file.trackCourse !== trackCourse) continue;
    for (const session of file.sessions) {
      const drivers = session.drivers.filter(d => names.includes(d.name) && d.carType === carType);
      for (const driver of drivers) {
        for (const lap of driver.laps) {
          if (lap.sector1 !== null && (bestS1 === null || lap.sector1 < bestS1)) bestS1 = lap.sector1;
          if (lap.sector2 !== null && (bestS2 === null || lap.sector2 < bestS2)) bestS2 = lap.sector2;
          if (lap.sector3 !== null && (bestS3 === null || lap.sector3 < bestS3)) bestS3 = lap.sector3;
        }
      }
    }
  }

  const total = bestS1 !== null && bestS2 !== null && bestS3 !== null
    ? bestS1 + bestS2 + bestS3 : null;

  return { s1: bestS1, s2: bestS2, s3: bestS3, total };
}

export interface TrackStats {
  trackVenue: string;
  trackCourse: string;
  sessionCount: number;
  totalLaps: number;
  bestLapTime: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  bestCar: string;
  bestCarClass: CarClass;
  classes: CarClass[];
}

export function getTrackStats(files: RaceFile[], driverNames: string | string[]): TrackStats[] {
  const names = asArray(driverNames);
  const map = new Map<string, TrackStats>();

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      let existing = map.get(file.trackCourse);
      if (!existing) {
        existing = {
          trackVenue: file.trackVenue,
          trackCourse: file.trackCourse,
          sessionCount: 0,
          totalLaps: 0,
          bestLapTime: null,
          bestS1: null,
          bestS2: null,
          bestS3: null,
          bestCar: '',
          bestCarClass: driver.carClass,
          classes: [],
        };
        map.set(file.trackCourse, existing);
      }

      existing.sessionCount++;
      existing.totalLaps += driver.totalLaps;
      if (!existing.classes.includes(driver.carClass)) {
        existing.classes.push(driver.carClass);
      }

      for (const lap of driver.laps) {
        if (!lap.lapTime || lap.lapTime <= 0) continue;
        if (!existing.bestLapTime || lap.lapTime < existing.bestLapTime) {
          existing.bestLapTime = lap.lapTime;
          existing.bestS1 = lap.sector1;
          existing.bestS2 = lap.sector2;
          existing.bestS3 = lap.sector3;
          existing.bestCar = driver.carType;
          existing.bestCarClass = driver.carClass;
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
}

export interface CarStats {
  carType: string;
  carClass: CarClass;
  sessionCount: number;
  totalLaps: number;
  totalDistanceKm: number;
  tracks: string[];
}

export function getCarStats(files: RaceFile[], driverNames: string | string[]): CarStats[] {
  const names = asArray(driverNames);
  const map = new Map<string, CarStats>();

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      const existing = map.get(driver.carType);
      if (existing) {
        existing.sessionCount++;
        existing.totalLaps += driver.totalLaps;
        existing.totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
        if (!existing.tracks.includes(file.trackCourse)) {
          existing.tracks.push(file.trackCourse);
        }
      } else {
        map.set(driver.carType, {
          carType: driver.carType,
          carClass: driver.carClass,
          sessionCount: 1,
          totalLaps: driver.totalLaps,
          totalDistanceKm: (driver.totalLaps * file.trackLength) / 1000,
          tracks: [file.trackCourse],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
}

export interface OverviewStats {
  totalSessions: number;
  totalLaps: number;
  totalRaces: number;
  totalRaceLaps: number;
  totalPractice: number;
  totalQualifying: number;
  tracksVisited: number;
  carsUsed: number;
  bestOverallLap: PersonalBest | null;
  totalIncidents: number;
  totalPenalties: number;
  totalTrackLimits: number;
  penaltyTypes: Map<string, number>;
  avgLapTime: number | null;
  totalDistanceKm: number;
}

export function getOverviewStats(files: RaceFile[], driverNames: string | string[]): OverviewStats {
  const names = asArray(driverNames);
  let totalSessions = 0;
  let totalLaps = 0;
  let totalRaces = 0;
  let totalRaceLaps = 0;
  let totalPractice = 0;
  let totalQualifying = 0;
  let totalIncidents = 0;
  let totalPenalties = 0;
  let totalTrackLimits = 0;
  const penaltyTypes = new Map<string, number>();
  let totalDistanceKm = 0;
  let lapTimeSum = 0;
  let lapTimeCount = 0;
  const tracks = new Set<string>();
  const cars = new Set<string>();
  let bestLap: PersonalBest | null = null;

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      totalSessions++;
      totalLaps += driver.totalLaps;
      totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
      tracks.add(file.trackCourse);
      cars.add(driver.carType);

      if (session.type === 'Race') { totalRaces++; totalRaceLaps += driver.totalLaps; }
      else if (session.type === 'Practice') totalPractice++;
      else if (session.type === 'Qualifying') totalQualifying++;

      totalIncidents += session.incidents.filter(
        i => names.some(n => isDriverIncident(i, n))
      ).length;
      const driverPenalties = session.penalties.filter(p => names.includes(p.driver));
      totalPenalties += driverPenalties.length;
      for (const pen of driverPenalties) {
        const t = pen.type || 'Unknown';
        penaltyTypes.set(t, (penaltyTypes.get(t) ?? 0) + 1);
      }
      totalTrackLimits += session.trackLimits.filter(tl => names.includes(tl.driver)).length;

      for (const lap of driver.laps) {
        if (lap.lapTime && lap.lapTime > 0) {
          lapTimeSum += lap.lapTime;
          lapTimeCount++;
          if (!bestLap || lap.lapTime < bestLap.lapTime) {
            bestLap = toLapRecord(file, session, driver, lap);
          }
        }
      }
    }
  }

  return {
    totalSessions,
    totalLaps,
    totalRaces,
    totalRaceLaps,
    totalPractice,
    totalQualifying,
    tracksVisited: tracks.size,
    carsUsed: cars.size,
    bestOverallLap: bestLap,
    totalIncidents,
    totalPenalties,
    totalTrackLimits,
    penaltyTypes,
    avgLapTime: lapTimeCount > 0 ? lapTimeSum / lapTimeCount : null,
    totalDistanceKm,
  };
}

export interface RaceResult {
  file: RaceFile;
  session: SessionData;
  driver: DriverResult;
  position: number;
  classPosition: number;
  totalDrivers: number;
  classDrivers: number;
}

export function getRaceResults(files: RaceFile[], driverNames: string | string[]): RaceResult[] {
  const names = asArray(driverNames);
  const results: RaceResult[] = [];

  for (const file of files) {
    for (const session of file.sessions) {
      if (session.type !== 'Race') continue;
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      const classDrivers = session.drivers.filter(d => d.carClass === driver.carClass);

      results.push({
        file,
        session,
        driver,
        position: driver.position,
        classPosition: driver.classPosition,
        totalDrivers: session.drivers.length,
        classDrivers: classDrivers.length,
      });
    }
  }

  return results.sort((a, b) => b.file.timeString.localeCompare(a.file.timeString));
}

export interface TrackBest {
  trackVenue: string;
  trackCourse: string;
  totalLaps: number;
  bestLapTime: number;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  bestCar: string;
  bestCarClass: CarClass;
  theoreticalBest: number | null;
  theoS1: number | null;
  theoS2: number | null;
  theoS3: number | null;
}

export interface RaceStats {
  races: number;
  wins: number;
  podiums: number;
  classWins: number;
  classPodiums: number;
  dnfs: number;
  fastestLaps: number;
  poles: number;
}

export interface DriverProfileStats {
  driverName: string;
  total: RaceStats;
  online: RaceStats;
  rated: RaceStats;
  totalLaps: number;
  totalDistanceKm: number;
  totalSessions: number;
  tracksVisited: number;
  carsUsed: number;
  trackBests: TrackBest[];
}

export function getDriverProfileStats(files: RaceFile[], driverNames: string | string[]): DriverProfileStats {
  const names = asArray(driverNames);

  const total: RaceStats = { races: 0, wins: 0, podiums: 0, classWins: 0, classPodiums: 0, dnfs: 0, fastestLaps: 0, poles: 0 };
  const online: RaceStats = { races: 0, wins: 0, podiums: 0, classWins: 0, classPodiums: 0, dnfs: 0, fastestLaps: 0, poles: 0 };
  const rated: RaceStats = { races: 0, wins: 0, podiums: 0, classWins: 0, classPodiums: 0, dnfs: 0, fastestLaps: 0, poles: 0 };
  let totalLaps = 0;
  let totalDistanceKm = 0;
  let totalSessions = 0;
  const tracks = new Set<string>();
  const cars = new Set<string>();

  const trackBestMap = new Map<string, { lapTime: number; s1: number | null; s2: number | null; s3: number | null; car: string; carClass: CarClass }>();
  const trackLapsMap = new Map<string, number>();

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      totalSessions++;
      totalLaps += driver.totalLaps;
      totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
      tracks.add(file.trackCourse);
      cars.add(driver.carType);
      trackLapsMap.set(file.trackCourse, (trackLapsMap.get(file.trackCourse) ?? 0) + driver.totalLaps);

      if (session.type === 'Race') {
        const isOnline = file.setting === 'Multiplayer';
        const isDnf = driver.finishStatus !== '' && driver.finishStatus !== 'Finished Normally'
            && driver.finishStatus !== 'None';

        // Fastest lap: check if this driver had the best lap in their class
        const classDrivers = session.drivers.filter(d => d.carClass === driver.carClass);
        const classBestLap = Math.min(...classDrivers.map(d => d.bestLapTime ?? Infinity));
        const hasFastestLap = driver.bestLapTime !== null && driver.bestLapTime > 0
          && Math.abs(driver.bestLapTime - classBestLap) < 0.001;

        // Pole position: started P1 in class
        const hasPole = driver.classGridPosition === 1;

        total.races++;
        if (driver.position === 1) total.wins++;
        if (driver.position <= 3) total.podiums++;
        if (driver.classPosition === 1) total.classWins++;
        if (driver.classPosition <= 3) total.classPodiums++;
        if (isDnf) total.dnfs++;
        if (hasFastestLap) total.fastestLaps++;
        if (hasPole) total.poles++;

        if (isOnline) {
          online.races++;
          if (driver.position === 1) online.wins++;
          if (driver.position <= 3) online.podiums++;
          if (driver.classPosition === 1) online.classWins++;
          if (driver.classPosition <= 3) online.classPodiums++;
          if (isDnf) online.dnfs++;
          if (hasFastestLap) online.fastestLaps++;
          if (hasPole) online.poles++;
        }

        if (isRatedRace(file)) {
          rated.races++;
          if (driver.position === 1) rated.wins++;
          if (driver.position <= 3) rated.podiums++;
          if (driver.classPosition === 1) rated.classWins++;
          if (driver.classPosition <= 3) rated.classPodiums++;
          if (isDnf) rated.dnfs++;
          if (hasFastestLap) rated.fastestLaps++;
          if (hasPole) rated.poles++;
        }
      }

      for (const lap of driver.laps) {
        if (!lap.lapTime || lap.lapTime <= 0) continue;
        const existing = trackBestMap.get(file.trackCourse);
        if (!existing || lap.lapTime < existing.lapTime) {
          trackBestMap.set(file.trackCourse, {
            lapTime: lap.lapTime,
            s1: lap.sector1,
            s2: lap.sector2,
            s3: lap.sector3,
            car: driver.carType,
            carClass: driver.carClass,
          });
        }
      }
    }
  }

  // Build theoretical bests in a single pass (instead of calling getTheoreticalBest per track)
  const theoMap = new Map<string, { s1: number | null; s2: number | null; s3: number | null }>();
  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;
      const best = trackBestMap.get(file.trackCourse);
      if (!best || driver.carType !== best.car) continue;
      const key = file.trackCourse;
      let entry = theoMap.get(key);
      if (!entry) { entry = { s1: null, s2: null, s3: null }; theoMap.set(key, entry); }
      for (const lap of driver.laps) {
        if (lap.sector1 !== null && (entry.s1 === null || lap.sector1 < entry.s1)) entry.s1 = lap.sector1;
        if (lap.sector2 !== null && (entry.s2 === null || lap.sector2 < entry.s2)) entry.s2 = lap.sector2;
        if (lap.sector3 !== null && (entry.s3 === null || lap.sector3 < entry.s3)) entry.s3 = lap.sector3;
      }
    }
  }

  // Build track bests with theoretical times
  const trackBests: TrackBest[] = [];
  for (const [trackCourse, best] of trackBestMap) {
    const theo = theoMap.get(trackCourse);
    const theoTotal = theo?.s1 != null && theo?.s2 != null && theo?.s3 != null
      ? theo.s1 + theo.s2 + theo.s3 : null;
    // Find the trackVenue for this course
    const trackVenue = files.find(f => f.trackCourse === trackCourse)?.trackVenue ?? trackCourse;
    trackBests.push({
      trackVenue,
      trackCourse,
      totalLaps: trackLapsMap.get(trackCourse) ?? 0,
      bestLapTime: best.lapTime,
      bestS1: best.s1,
      bestS2: best.s2,
      bestS3: best.s3,
      bestCar: best.car,
      bestCarClass: best.carClass,
      theoreticalBest: theoTotal,
      theoS1: theo?.s1 ?? null,
      theoS2: theo?.s2 ?? null,
      theoS3: theo?.s3 ?? null,
    });
  }
  trackBests.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse));

  return {
    driverName: names.join(', '),
    total,
    online,
    rated,
    totalLaps,
    totalDistanceKm,
    totalSessions,
    tracksVisited: tracks.size,
    carsUsed: cars.size,
    trackBests,
  };
}
