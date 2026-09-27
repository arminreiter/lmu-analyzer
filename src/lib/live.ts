/**
 * Live telemetry from LMU's local REST API (desktop only, via the `lmu_live` Tauri command),
 * plus the reference laps (my PBs, theoretical best, benchmark tiers) the live views compare against.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { KEYS, lsGet } from './storage';
import { useBenchmarks } from './useBenchmarks';
import { getAllLaps } from './analytics';
import { resolveCarClass } from './parser';
import { errorMessage } from './formatting';
import { mapTrackName, type PaceBenchmark, type PaceRating } from './racepace';
import type { RaceFile, PersonalBest, CarClass } from './types';

/** Subset of LMU's /rest/watch/standings entry. Sector fields are cumulative (S1, S1+S2); unset times are <= 0. */
export interface LiveVehicle {
  player: boolean;
  driverName: string;
  vehicleName: string;
  carClass: string;
  lapsCompleted: number;
  timeIntoLap: number;
  bestLapTime: number;
  lastLapTime: number;
  currentSectorTime1: number;
  currentSectorTime2: number;
  lastSectorTime1: number;
  lastSectorTime2: number;
}

export interface LiveState {
  player: LiveVehicle | null;
  trackName: string;
  session: string;
}

/** A reference lap: total time plus cumulative splits (S1, S1+S2) when known. `id` is stable across cars/tracks. */
export interface Reference {
  id: string;
  label: string;
  time: number;
  splits: [number, number] | null;
  rating?: PaceRating;
}

export type Sectors = [number | null, number | null, number | null];

// ponytail: 250ms polling of localhost; switch to LMU shared memory if we ever need per-frame data
const POLL_MS = 250;

const TIERS: Array<[keyof PaceBenchmark['racePace'], PaceRating]> =
  [['alien', 'Alien'], ['competitive', 'Competitive'], ['good', 'Good'], ['midpack', 'Midpack'], ['tailEnder', 'Tail-ender'], ['offline', 'Offline']];

/** LMU reports missing times as 0 or -1 */
export const time = (v: number | undefined) => (v && v > 0 ? v : null);

const lapSplits = (lap: PersonalBest): [number, number] | null =>
  lap.sector1 !== null && lap.sector2 !== null ? [lap.sector1, lap.sector1 + lap.sector2] : null;

/** Cumulative splits of `ref`; references without their own (benchmarks) borrow `shape`'s, scaled to their time */
export function refSplits(ref: Reference, shape: Reference | null): [number, number] | null {
  if (ref.splits) return ref.splits;
  if (!shape?.splits) return null;
  const k = ref.time / shape.time;
  return [shape.splits[0] * k, shape.splits[1] * k];
}

/** Individual sector times from cumulative S1, S1+S2 and lap time */
export function toSectors(cum1: number | null, cum2: number | null, lap: number | null): Sectors {
  return [cum1, cum1 !== null && cum2 !== null ? cum2 - cum1 : null, cum2 !== null && lap !== null ? lap - cum2 : null];
}

/** Gap of the running lap to `ref` at the last completed sector */
export function liveDelta(current: { s1: number | null; s2: number | null }, ref: Reference, shape: Reference | null): number | null {
  const splits = refSplits(ref, shape);
  if (!splits) return null;
  if (current.s2 !== null) return current.s2 - splits[1];
  if (current.s1 !== null) return current.s1 - splits[0];
  return null;
}

/** Polls LMU and collects the laps completed while mounted (newest first). */
export function useLiveTelemetry() {
  const [live, setLive] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionLaps, setSessionLaps] = useState<Array<{ lap: number; time: number; sectors: Sectors }>>([]);
  const lastLapsCompleted = useRef<number | null>(null);

  // Sequential polling — the next request starts only after the previous one settles
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const [standings, info] = await invoke<[string, string]>('lmu_live');
        const vehicles = JSON.parse(standings) as LiveVehicle[];
        const session = JSON.parse(info) as { trackName?: string; session?: string };
        if (cancelled) return;
        const me = vehicles.find(v => v.player) ?? null;
        setLive({ player: me, trackName: session.trackName ?? '', session: session.session ?? '' });
        // A lower lap count means a new session
        const prev = lastLapsCompleted.current;
        if (me && prev !== null && me.lapsCompleted < prev) setSessionLaps([]);
        else if (me && prev !== null && me.lapsCompleted > prev && time(me.lastLapTime) !== null) {
          const sectors = toSectors(time(me.lastSectorTime1), time(me.lastSectorTime2), me.lastLapTime);
          setSessionLaps(laps => [{ lap: me.lapsCompleted, time: me.lastLapTime, sectors }, ...laps]);
        }
        if (me) lastLapsCompleted.current = me.lapsCompleted;
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return { live, error, sessionLaps };
}

/**
 * Reference laps for the live track + class: my PB with this car, my class PB (other car),
 * theoretical best, and benchmark tiers. `pb` is the first one with splits — the shape benchmarks borrow.
 */
export function useLiveReferences(files: RaceFile[], driverNames: string[], benchmarksEnabled: boolean, live: LiveState | null) {
  const { benchmarkMap } = useBenchmarks();
  const trackName = live?.trackName ?? '';
  const carClass: CarClass | null = live?.player ? resolveCarClass(live.player.carClass) : null;
  const vehicleName = live?.player?.vehicleName ?? '';

  // My laps at this track in this class, and the car type matching the live vehicle (XML VehName)
  const history = useMemo(() => {
    if (!trackName || !carClass) return null;
    const laps = getAllLaps(files, driverNames)
      .filter(l => (l.trackCourse === trackName || l.trackVenue === trackName) && l.carClass === carClass);
    let carType: string | null = null;
    for (const file of files) for (const s of file.sessions) for (const d of s.drivers) {
      if (d.vehicleName === vehicleName) carType = d.carType;
    }
    return { laps, carType };
  }, [files, driverNames, trackName, carClass, vehicleName]);

  const references = useMemo(() => {
    const refs: Reference[] = [];
    if (history) {
      const carLaps = history.laps.filter(l => l.carType === history.carType);
      // getAllLaps is sorted by lap time, so [0] is the best
      if (carLaps[0]) refs.push({ id: 'pb', label: `My PB · ${carLaps[0].carType}`, time: carLaps[0].lapTime, splits: lapSplits(carLaps[0]) });
      if (history.laps[0] && history.laps[0] !== carLaps[0]) {
        refs.push({ id: 'pb-class', label: `My PB · ${history.laps[0].carType}`, time: history.laps[0].lapTime, splits: lapSplits(history.laps[0]) });
      }
      const pool = carLaps.length ? carLaps : history.laps;
      const min = (pick: (l: PersonalBest) => number | null) =>
        pool.reduce<number | null>((m, l) => { const v = pick(l); return v !== null && (m === null || v < m) ? v : m; }, null);
      const [s1, s2, s3] = [min(l => l.sector1), min(l => l.sector2), min(l => l.sector3)];
      if (s1 !== null && s2 !== null && s3 !== null) refs.push({ id: 'theoretical', label: 'Theoretical best', time: s1 + s2 + s3, splits: [s1, s1 + s2] });
    }
    const benchmark = benchmarksEnabled && carClass && benchmarkMap
      ? benchmarkMap.get(`${mapTrackName(trackName, trackName)}|${carClass}`)
      : undefined;
    if (benchmark) {
      for (const [key, rating] of TIERS) refs.push({ id: key, label: rating, time: benchmark.racePace[key], splits: null, rating });
    }
    return refs;
  }, [history, benchmarkMap, benchmarksEnabled, carClass, trackName]);

  const pb = references.find(r => r.splits && !r.rating) ?? null;
  // My all-time best individual sectors — beating one improves the theoretical best (purple)
  const theo = references.find(r => r.id === 'theoretical');
  const bestSectors: Sectors = theo?.splits ? toSectors(theo.splits[0], theo.splits[1], theo.time) : [null, null, null];
  return { references, pb, carClass, bestSectors };
}

/** Opens the always-on-top overlay window at its last position, or closes it if already open. */
export async function toggleOverlay() {
  const existing = await WebviewWindow.getByLabel('overlay');
  if (existing) { await existing.close(); return; }
  let pos: { x?: number; y?: number } = {};
  try { pos = JSON.parse(lsGet(KEYS.overlayPosition) ?? '{}'); } catch { /* default position */ }
  new WebviewWindow('overlay', {
    url: 'index.html?overlay',
    title: 'LMU Overlay',
    width: 300,
    height: 190,
    ...pos,
    decorations: false,
    transparent: true,
    shadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
  });
}

/**
 * Timing-screen color for a sector or lap (F1/WEC semantics, see CLAUDE.md):
 * purple beats my all-time best (improves the theoretical best), green is a session best, yellow is slower.
 */
export function timingClass(t: number | null, allTimeBest: number | null, sessionBest: number | null, record = 'text-racing-purple'): string {
  if (t === null) return 'text-racing-muted';
  if (allTimeBest !== null && t < allTimeBest) return record;
  if (sessionBest === null || t <= sessionBest) return 'text-racing-green';
  return 'text-racing-yellow';
}

/** Per-sector minimum over the laps completed this session */
export function sessionBestSectors(laps: Array<{ sectors: Sectors }>): Sectors {
  return [0, 1, 2].map(i => laps.reduce<number | null>((m, l) => {
    const v = l.sectors[i];
    return v !== null && (m === null || v < m) ? v : m;
  }, null)) as Sectors;
}
