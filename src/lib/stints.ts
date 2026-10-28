import { getTireWearPerLap, isValidLap } from './analytics';
import type { DriverChangeData, DriverResult, LapData, SessionData } from './types';

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pace you can repeat: the median of your 5 fastest laps (null with fewer than 3, a single lap says too little) */
export function truePace(lapTimes: number[]): number | null {
  if (lapTimes.length < 3) return null;
  return median([...lapTimes].sort((a, b) => a - b).slice(0, 5));
}

/**
 * Laps whose fuel/VE use is representative: not lap 1 (formation/standing start),
 * not an in-lap (pit lane) and not an out-lap — LMU logs the refuel into the out-lap's
 * fuelUsed/veUsed, so those values are garbage.
 */
export function usageLaps(laps: LapData[]): LapData[] {
  // Must see a driver's whole lap list: on a stint slice the out-lap is first and has no previous lap
  return laps.filter((lap, i) => lap.num > 1 && !lap.isPit && !laps[i - 1]?.isPit);
}

/** Median fuel and Virtual Energy per lap over laps already passed through usageLaps (fractions of a tank / full VE) */
export function usageMedians(usable: LapData[]): { fuel: number | null; ve: number | null } {
  return {
    fuel: median(usable.map(l => l.fuelUsed).filter(v => v > 0)),
    ve: median(usable.map(l => l.vehicleEnergyUsed).filter(v => v > 0)),
  };
}

export function usagePerLap(laps: LapData[]): { fuel: number | null; ve: number | null } {
  return usageMedians(usageLaps(laps));
}

/** Pace laps among laps already passed through usageLaps: valid and within 107% of their median (drops spins, yellows, traffic) */
function cleanTimes(usable: LapData[]): number[] {
  const times = usable.filter(isValidLap).map(l => l.lapTime);
  const med = median(times);
  return med === null ? [] : times.filter(t => t <= med * 1.07);
}

/** Lap times that show pace: valid, not lap 1, no pit lane, and within 107% of the median */
export function cleanLapTimes(laps: LapData[]): number[] {
  return cleanTimes(usageLaps(laps));
}

/** When lap i was completed (session clock): the next lap's start, else start + lap time. LMU writes
 *  et="--.---" (parsed as 0) for some laps, e.g. after a rejoin — those starts don't count. */
function lapEnd(laps: LapData[], i: number): number | null {
  const next = laps[i + 1]?.elapsedTime ?? 0;
  if (next > 0) return next;
  const lap = laps[i];
  return lap.elapsedTime > 0 && lap.lapTime ? lap.elapsedTime + lap.lapTime : null;
}

/** Least-squares slope of lap time over the stint, in seconds per lap (positive = getting slower) */
function paceTrend(laps: LapData[], clean: Set<number>): number | null {
  const pts = laps.filter(l => l.lapTime !== null && clean.has(l.lapTime)).map(l => [l.num, l.lapTime!] as const);
  if (pts.length < 3) return null;
  const mx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  const den = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / den;
}

export interface Stint {
  index: number;
  startLap: number;
  endLap: number;
  laps: LapData[];
  /** Who drove it per LMU's driver-change log; null when the car has no logged swaps */
  driver: string | null;
  compound: string;
  avgPace: number | null;
  bestLap: number | null;
  /** Seconds per lap the pace drifts over the stint */
  trend: number | null;
  fuelPerLap: number | null;
  vePerLap: number | null;
  /** Average tyre wear per lap, in % */
  wearPerLap: number | null;
  /** Time the pit stop that ends this stint cost vs two clean laps; null for the last stint */
  pitLoss: number | null;
}

/**
 * This car's swaps from the stream log. Several cars can share a livery name ("… Custom Team #397"),
 * so keep only the chain of swaps connected to this entry's driver.
 */
export function carDriverChanges(session: SessionData, driver: DriverResult): DriverChangeData[] {
  const sameName = (session.driverChanges ?? []).filter(c => c.vehicle === driver.vehicleName);
  // The entry slot identifies the car exactly; use it when a swap names this entry's driver
  const own = sameName.find(c => c.slot !== undefined && (c.oldDriver === driver.name || c.newDriver === driver.name));
  if (own) return sameName.filter(c => c.slot === own.slot);
  // Otherwise (older caches have no slot) follow the chain of names linked to this entry's driver
  const names = new Set([driver.name]);
  for (let grew = true; grew;) {
    grew = false;
    for (const c of sameName) {
      if (names.has(c.oldDriver) !== names.has(c.newDriver)) {
        names.add(c.oldDriver);
        names.add(c.newDriver);
        grew = true;
      }
    }
  }
  return sameName.filter(c => names.has(c.oldDriver) && names.has(c.newDriver));
}

/** Whether per-stint drivers can be trusted: the car's <Swap> list, or a log that has every swap LMU counted */
export function hasReliableDrivers(driver: DriverResult, changes: DriverChangeData[]): boolean {
  if ((driver.swaps?.length ?? 0) > 1) return true;
  return changes.length > 0 && driver.numDriverChanges !== undefined && changes.length >= driver.numDriverChanges;
}

/**
 * Who drove a stint: the <Swap> covering its last lap, else the log as of when its first lap ended.
 * A <Swap> range ends on the in-lap or on the out-lap after it, depending on where the stop falls,
 * so the out-lap can belong to either driver — the in-lap is always inside its own driver's range.
 */
function stintDriver(driver: DriverResult, changes: DriverChangeData[], lastLap: number, firstLapEnd: number | null): string | null {
  if (driver.swaps?.length) return driver.swaps.find(s => lastLap >= s.startLap && lastLap <= s.endLap)?.driver ?? null;
  if (changes.length === 0 || firstLapEnd === null) return null;
  const last = changes.filter(c => c.time <= firstLapEnd).at(-1);
  return last ? last.newDriver : changes[0].oldDriver;
}

/** Split a driver's laps into stints at each pit lap (the pit flag sits on the in-lap) */
export function getStints(driver: DriverResult, session: SessionData): Stint[] {
  // Split at pit laps, and at a <Swap> boundary away from a stop (a garage swap in practice/quali)
  const swapAt = (num: number) => driver.swaps?.find(s => num >= s.startLap && num <= s.endLap)?.driver;
  const groups: LapData[][] = [[]];
  driver.laps.forEach((lap, i) => {
    const prev = driver.laps[i - 1];
    const nearStop = prev?.isPit || driver.laps[i - 2]?.isPit;
    if (prev && !nearStop && driver.swaps && swapAt(lap.num) !== swapAt(prev.num)) groups.push([]);
    groups.at(-1)!.push(lap);
    if (lap.isPit) groups.push([]);
  });
  if (groups.at(-1)!.length === 0) groups.pop();

  const usable = new Set(usageLaps(driver.laps));
  const changes = carDriverChanges(session, driver);
  const sessionPace = median(cleanTimes([...usable]));
  let lapIndex = 0;
  return groups.map((laps, index): Stint => {
    const stintUsable = laps.filter(l => usable.has(l));
    const clean = cleanTimes(stintUsable);
    const usage = usageMedians(stintUsable);
    // The swap is logged during the stop, after the out-lap has started — ask who drove when it ended
    // (or the next lap whose end is known; LMU leaves some lap starts blank)
    const start = lapIndex;
    const firstLapEnd = laps.map((_, k) => lapEnd(driver.laps, start + k)).find(t => t !== null) ?? null;
    lapIndex += laps.length;
    const inLap = laps.at(-1)!;
    const outLap = groups[index + 1]?.[0];
    const pitLoss = inLap.isPit && outLap && inLap.lapTime && outLap.lapTime && sessionPace
      ? inLap.lapTime + outLap.lapTime - 2 * sessionPace
      : null;
    return {
      index,
      startLap: laps[0].num,
      endLap: inLap.num,
      laps,
      driver: stintDriver(driver, changes, inLap.num, firstLapEnd),
      compound: laps.find(l => l.frontCompound)?.frontCompound ?? '',
      avgPace: clean.length ? clean.reduce((s, t) => s + t, 0) / clean.length : null,
      bestLap: clean.length ? Math.min(...clean) : null,
      trend: paceTrend(laps, new Set(clean)),
      fuelPerLap: usage.fuel,
      vePerLap: usage.ve,
      wearPerLap: getTireWearPerLap(laps),
      pitLoss,
    };
  });
}

function lapEndTimes(laps: LapData[]): Map<number, number> {
  const ends = new Map<number, number>();
  laps.forEach((lap, i) => {
    const end = lapEnd(laps, i);
    if (end !== null) ends.set(lap.num, end);
  });
  return ends;
}

export interface GapPoint {
  lap: number;
  /** Seconds behind whoever completed this lap first in the class */
  leader: number;
  /** Seconds behind the closest class car that completed this lap before me; null while leading */
  ahead: number | null;
  aheadName: string | null;
}

/** Per lap: gap to the class leader and to the class car directly ahead, from lap completion times */
export function getClassGaps(driver: DriverResult, session: SessionData): GapPoint[] {
  const mine = lapEndTimes(driver.laps);
  const rivals = session.drivers
    .filter(d => d.carClass === driver.carClass && d.name !== driver.name)
    .map(d => ({ name: d.name, ends: lapEndTimes(d.laps) }));
  const points: GapPoint[] = [];
  for (const [lap, end] of mine) {
    let leader = end, ahead: { name: string; end: number } | null = null;
    for (const r of rivals) {
      const t = r.ends.get(lap);
      if (t === undefined) continue;
      leader = Math.min(leader, t);
      if (t < end && (!ahead || t > ahead.end)) ahead = { name: r.name, end: t };
    }
    points.push({ lap, leader: end - leader, ahead: ahead ? end - ahead.end : null, aheadName: ahead?.name ?? null });
  }
  return points;
}

export interface FuelPlanInput {
  /** Race length in laps — already converted from minutes by the caller when timed */
  raceLaps: number;
  /** Fraction of a full tank used per lap */
  fuelPerLap: number;
  /** Fraction of full Virtual Energy used per lap; 0 when the car has no VE limit */
  vePerLap: number;
  /** Extra laps of fuel/VE to carry as a buffer */
  marginLaps: number;
}

export interface FuelPlan {
  totalFuel: number;
  totalVe: number;
  /** Laps one full tank (or full VE) lasts — whichever runs out first */
  lapsPerStint: number;
  limitedBy: 'fuel' | 've';
  stops: number;
  stints: { startLap: number; endLap: number; fuel: number; ve: number }[];
}

/** Laps a timed race lasts: the leader takes the flag on the lap after the clock runs out */
export function lapsForMinutes(minutes: number, lapTime: number): number {
  if (minutes <= 0 || lapTime <= 0) return 0;
  return Math.floor((minutes * 60) / lapTime) + 1;
}

/** Stops and per-stint fill for a race, starting full and stopping as late as the tank/VE allows */
export function planFuel({ raceLaps, fuelPerLap, vePerLap, marginLaps }: FuelPlanInput): FuelPlan | null {
  if (raceLaps <= 0 || fuelPerLap <= 0) return null;
  const veLimited = vePerLap > fuelPerLap;
  const perLap = veLimited ? vePerLap : fuelPerLap;
  // The buffer comes out of every stint, so a full tank runs this many racing laps
  const lapsPerStint = Math.floor(1 / perLap - marginLaps);
  if (lapsPerStint < 1) return null;

  const stints: FuelPlan['stints'] = [];
  for (let start = 1; start <= raceLaps; start += lapsPerStint) {
    const end = Math.min(raceLaps, start + lapsPerStint - 1);
    const laps = end - start + 1 + marginLaps;
    stints.push({ startLap: start, endLap: end, fuel: Math.min(1, laps * fuelPerLap), ve: Math.min(1, laps * vePerLap) });
  }
  return {
    totalFuel: (raceLaps + marginLaps) * fuelPerLap,
    totalVe: (raceLaps + marginLaps) * vePerLap,
    lapsPerStint,
    limitedBy: veLimited ? 've' : 'fuel',
    stops: stints.length - 1,
    stints,
  };
}
