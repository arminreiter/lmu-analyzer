import type { RaceFile, PersonalBest, DriverSummary, DriverResult, SessionData, CarClass } from './types';

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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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

export function getClassBgClass(carClass: CarClass): string {
  switch (carClass) {
    case 'Hyper': return 'bg-hyper/20 text-hyper border-hyper/30';
    case 'GT3': return 'bg-gt3/20 text-gt3 border-gt3/30';
    case 'GTE': return 'bg-gte/20 text-gte border-gte/30';
    case 'LMP3': return 'bg-lmp3/20 text-lmp3 border-lmp3/30';
    default: return 'bg-racing-muted/20 text-racing-muted border-racing-muted/30';
  }
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
  const order: CarClass[] = ['Hyper', 'GT3', 'GTE', 'LMP3'];
  return order.filter(c => classes.has(c));
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

export function detectPlayerDriver(files: RaceFile[]): string | null {
  const drivers = getAllDrivers(files);
  const players = drivers.filter(d => d.isPlayer);
  if (players.length === 0) return drivers[0]?.name ?? null;
  players.sort((a, b) => b.sessionCount - a.sessionCount);
  return players[0].name;
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
            const hasKnown = players.some(p => localNames.has(p.name));
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
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
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
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
  const bests = new Map<string, PersonalBest>();

  for (const file of files) {
    for (const session of file.sessions) {
      const drivers = session.drivers.filter(d => names.includes(d.name));
      for (const driver of drivers) {
        for (const lap of driver.laps) {
          if (!lap.lapTime || lap.lapTime <= 0) continue;

          const key = `${file.trackVenue}|${driver.carType}`;
          const existing = bests.get(key);

          if (!existing || lap.lapTime < existing.lapTime) {
            bests.set(key, {
              lapTime: lap.lapTime,
              sector1: lap.sector1,
              sector2: lap.sector2,
              sector3: lap.sector3,
              topSpeed: lap.topSpeed,
              trackVenue: file.trackVenue,
              carType: driver.carType,
              carClass: driver.carClass,
              sessionType: session.type,
              date: file.timeString,
              fileName: file.fileName,
              lapNumber: lap.num,
              driverName: driver.name,
            });
          }
        }
      }
    }
  }

  const result = Array.from(bests.values());
  result.sort((a, b) => a.trackVenue.localeCompare(b.trackVenue) || a.lapTime - b.lapTime);
  return result;
}

export function getAllSessionBests(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
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
          const l = best.lap;
          results.push({
            lapTime: l.lapTime!,
            sector1: l.sector1,
            sector2: l.sector2,
            sector3: l.sector3,
            topSpeed: l.topSpeed,
            trackVenue: file.trackVenue,
            carType: driver.carType,
            carClass: driver.carClass,
            sessionType: session.type,
            date: file.timeString,
            fileName: file.fileName,
            lapNumber: l.num,
            driverName: driver.name,
          });
        }
      }
    }
  }

  results.sort((a, b) => a.trackVenue.localeCompare(b.trackVenue) || a.lapTime - b.lapTime);
  return results;
}

export function getTheoreticalBest(files: RaceFile[], driverNames: string | string[], trackVenue: string, carType: string): {
  s1: number | null; s2: number | null; s3: number | null; total: number | null;
} {
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
  let bestS1: number | null = null;
  let bestS2: number | null = null;
  let bestS3: number | null = null;

  for (const file of files) {
    if (file.trackVenue !== trackVenue) continue;
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name) && d.carType === carType);
      if (!driver) continue;
      for (const lap of driver.laps) {
        if (lap.sector1 !== null && (bestS1 === null || lap.sector1 < bestS1)) bestS1 = lap.sector1;
        if (lap.sector2 !== null && (bestS2 === null || lap.sector2 < bestS2)) bestS2 = lap.sector2;
        if (lap.sector3 !== null && (bestS3 === null || lap.sector3 < bestS3)) bestS3 = lap.sector3;
      }
    }
  }

  const total = bestS1 !== null && bestS2 !== null && bestS3 !== null
    ? bestS1 + bestS2 + bestS3 : null;

  return { s1: bestS1, s2: bestS2, s3: bestS3, total };
}

export interface TrackStats {
  trackVenue: string;
  sessionCount: number;
  totalLaps: number;
  bestLapTime: number | null;
  bestCar: string;
  classes: CarClass[];
}

export function getTrackStats(files: RaceFile[], driverNames: string | string[]): TrackStats[] {
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
  const map = new Map<string, TrackStats>();

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      const existing = map.get(file.trackVenue);
      if (existing) {
        existing.sessionCount++;
        existing.totalLaps += driver.totalLaps;
        if (driver.bestLapTime && (!existing.bestLapTime || driver.bestLapTime < existing.bestLapTime)) {
          existing.bestLapTime = driver.bestLapTime;
          existing.bestCar = driver.carType;
        }
        if (!existing.classes.includes(driver.carClass)) {
          existing.classes.push(driver.carClass);
        }
      } else {
        map.set(file.trackVenue, {
          trackVenue: file.trackVenue,
          sessionCount: 1,
          totalLaps: driver.totalLaps,
          bestLapTime: driver.bestLapTime,
          bestCar: driver.carType,
          classes: [driver.carClass],
        });
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
  bestLapTime: number | null;
  bestTrack: string;
  tracks: string[];
}

export function getCarStats(files: RaceFile[], driverNames: string | string[]): CarStats[] {
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
  const map = new Map<string, CarStats>();

  for (const file of files) {
    for (const session of file.sessions) {
      const driver = session.drivers.find(d => names.includes(d.name));
      if (!driver) continue;

      const existing = map.get(driver.carType);
      if (existing) {
        existing.sessionCount++;
        existing.totalLaps += driver.totalLaps;
        if (driver.bestLapTime && (!existing.bestLapTime || driver.bestLapTime < existing.bestLapTime)) {
          existing.bestLapTime = driver.bestLapTime;
          existing.bestTrack = file.trackVenue;
        }
        if (!existing.tracks.includes(file.trackVenue)) {
          existing.tracks.push(file.trackVenue);
        }
      } else {
        map.set(driver.carType, {
          carType: driver.carType,
          carClass: driver.carClass,
          sessionCount: 1,
          totalLaps: driver.totalLaps,
          bestLapTime: driver.bestLapTime,
          bestTrack: file.trackVenue,
          tracks: [file.trackVenue],
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
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
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
      tracks.add(file.trackVenue);
      cars.add(driver.carType);

      if (session.type === 'Race') { totalRaces++; totalRaceLaps += driver.totalLaps; }
      else if (session.type === 'Practice') totalPractice++;
      else if (session.type === 'Qualifying') totalQualifying++;

      totalIncidents += session.incidents.filter(
        i => names.some(n => i.description.includes(n) || i.driver1 === n)
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
            bestLap = {
              lapTime: lap.lapTime,
              sector1: lap.sector1,
              sector2: lap.sector2,
              sector3: lap.sector3,
              topSpeed: lap.topSpeed,
              trackVenue: file.trackVenue,
              carType: driver.carType,
              carClass: driver.carClass,
              sessionType: session.type,
              date: file.timeString,
              fileName: file.fileName,
              lapNumber: lap.num,
              driverName: driver.name,
            };
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
  const names = Array.isArray(driverNames) ? driverNames : [driverNames];
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
