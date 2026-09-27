/**
 * Live telemetry from LMU's local REST API (desktop only, via the `lmu_live` Tauri command),
 * plus the reference laps (my PBs, theoretical best, benchmark tiers) the live views compare against.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { KEYS, lsGet, lsSet } from './storage';
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
  /** Cumulative splits of this session's best lap */
  bestLapSectorTime1: number;
  bestLapSectorTime2: number;
  /** Elapsed session time when the current lap started */
  lapStartET: number;
  /** Whether the running lap counts (rF2 mCountLapFlag) */
  countLapFlag?: string | number;
}

/** A lap completed while the view was open. Invalidated laps keep their time but never count as bests. */
export interface SessionLap {
  lap: number;
  time: number;
  sectors: Sectors;
  invalid: boolean;
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
  /** Set for individual laps from my history (as opposed to PBs, theoretical best, benchmarks) */
  lap?: PersonalBest;
}

export type Sectors = [number | null, number | null, number | null];

// ponytail: 100ms polling of the game's web server (sector times only change at splits; the lap clock
// is interpolated by LapClock). Lower it if LMU copes; switch to shared memory for per-frame data.
const POLL_MS = 100;

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

/**
 * Whether the running lap still counts. rF2 semantics: 2 / "…AND_TIME" = lap and time count.
 * ponytail: LMU's exact flag spelling is unverified — a missing flag is treated as valid.
 */
export function lapCounts(p: LiveVehicle): boolean {
  const f = p.countLapFlag;
  return f === undefined || f === '' || f === 2 || /AND_TIME|^2$/i.test(String(f));
}

/**
 * The lap that ended between two samples. LMU may blank the time of an invalidated lap, so fall back
 * to the lap-start timestamps and the splits seen while it was running.
 */
export function completedLap(prev: LiveVehicle, now: LiveVehicle): SessionLap | null {
  const reported = time(now.lastLapTime);
  const measured = prev.lapStartET > 0 && now.lapStartET > prev.lapStartET ? now.lapStartET - prev.lapStartET : null;
  const lapTime = reported ?? measured;
  if (lapTime === null) return null;
  const cum1 = time(now.lastSectorTime1) ?? time(prev.currentSectorTime1);
  const cum2 = time(now.lastSectorTime2) ?? time(prev.currentSectorTime2);
  return { lap: now.lapsCompleted, time: lapTime, sectors: toSectors(cum1, cum2, lapTime), invalid: reported === null || !lapCounts(prev) };
}

/** Polls LMU and collects the laps completed while mounted (newest first). */
export function useLiveTelemetry() {
  const [live, setLive] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionLaps, setSessionLaps] = useState<SessionLap[]>([]);
  // Previous sample — its lap-in-progress data describes the lap that just ended
  const prevSample = useRef<LiveVehicle | null>(null);

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
        const prev = prevSample.current;
        // A lower lap count means a new session
        if (me && prev && me.lapsCompleted < prev.lapsCompleted) setSessionLaps([]);
        else if (me && prev && me.lapsCompleted > prev.lapsCompleted) {
          const lap = completedLap(prev, me);
          if (lap) setSessionLaps(laps => [lap, ...laps]);
        }
        if (me) prevSample.current = me;
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
 * theoretical best, benchmark tiers, and every other lap of mine there (`lap` set), fastest first.
 */
export function useLiveReferences(files: RaceFile[], driverNames: string[], benchmarksEnabled: boolean, live: LiveState | null) {
  const { benchmarkMap } = useBenchmarks();
  const trackName = live?.trackName ?? '';
  const carClass: CarClass | null = live?.player ? resolveCarClass(live.player.carClass) : null;
  const vehicleName = live?.player?.vehicleName ?? '';
  // Primitives, so the reference list only rebuilds when the session best actually changes
  const bestLapTime = live?.player?.bestLapTime;
  const bestSplit1 = live?.player?.bestLapSectorTime1;
  const bestSplit2 = live?.player?.bestLapSectorTime2;

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
      if (carLaps[0]) refs.push({ id: 'pb', label: `My PB · ${carLaps[0].carType}`, time: carLaps[0].lapTime, splits: lapSplits(carLaps[0]), lap: carLaps[0] });
      if (history.laps[0] && history.laps[0] !== carLaps[0]) {
        refs.push({ id: 'pb-class', label: `My PB · ${history.laps[0].carType}`, time: history.laps[0].lapTime, splits: lapSplits(history.laps[0]), lap: history.laps[0] });
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
    // This session's best lap, straight from LMU — covers laps driven before the view was opened
    const sessionBest = time(bestLapTime);
    if (sessionBest !== null) {
      const c1 = time(bestSplit1), c2 = time(bestSplit2);
      refs.push({ id: 'session-best', label: 'Session best', time: sessionBest, splits: c1 !== null && c2 !== null ? [c1, c2] : null });
    }
    if (benchmark) {
      for (const [key, rating] of TIERS) refs.push({ id: key, label: rating, time: benchmark.racePace[key], splits: null, rating });
    }
    // Every other lap of mine here, so any of them can be the comparison target
    if (history) {
      for (const lap of history.laps) {
        if (refs.some(r => r.lap === lap)) continue;
        refs.push({
          id: `lap:${lap.fileName}:${lap.sessionIndex}:${lap.lapNumber}`,
          // Date only (timeString is "YYYY/MM/DD HH:MM:SS") — keeps session and lap number visible in narrow cells
          label: `${lap.date.slice(0, 10)} · ${lap.sessionType} L${lap.lapNumber}`,
          time: lap.lapTime, splits: lapSplits(lap), lap,
        });
      }
    }
    // Fastest first, so the table reads top-down from the hardest target
    return refs.sort((a, b) => a.time - b.time);
  }, [history, benchmarkMap, benchmarksEnabled, carClass, trackName, bestLapTime, bestSplit1, bestSplit2]);

  // My actual PB (this car, else class) — the bar for a gold lap. Not the theoretical best, which sorts first.
  const pb = references.find(r => r.id === 'pb') ?? references.find(r => r.id === 'pb-class') ?? null;
  // Sector shape benchmarks are scaled from: my PB lap if it has splits, else the theoretical best
  const shape = pb?.splits ? pb : references.find(r => r.id === 'theoretical') ?? null;
  // My all-time best individual sectors — beating one improves the theoretical best (purple)
  const theo = references.find(r => r.id === 'theoretical');
  const bestSectors: Sectors = theo?.splits ? toSectors(theo.splits[0], theo.splits[1], theo.time) : [null, null, null];
  return { references, pb, shape, carClass, bestSectors };
}

/**
 * Opens the always-on-top overlay window at its last position, or closes it if already open.
 * Rejects when Tauri can't create the window (it reports that via `tauri://error`, not by throwing).
 */
export async function toggleOverlay(): Promise<void> {
  const existing = await WebviewWindow.getByLabel('overlay');
  if (existing) { await existing.close(); return; }
  let pos: { x?: number; y?: number } = {};
  try { pos = JSON.parse(lsGet(KEYS.overlayPosition) ?? '{}'); } catch { /* default position */ }
  const win = new WebviewWindow('overlay', {
    url: 'index.html?overlay',
    title: 'LMU Overlay',
    // Initial size only — the overlay resizes itself to its content
    width: 240,
    height: 200,
    ...pos,
    decorations: false,
    transparent: true,
    shadow: false,
    alwaysOnTop: true,
    resizable: false,
    focus: true,
  });
  await new Promise<void>((resolve, reject) => {
    void win.once('tauri://created', () => resolve());
    void win.once<string>('tauri://error', e => reject(new Error(String(e.payload))));
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

/**
 * When a live sector turns purple: 'targets' — faster than every selected target *and* my all-time
 * best sector; 'personal' — whenever it beats my all-time best sector, whatever the targets say.
 */
export type PurpleMode = 'targets' | 'personal';

export function usePurpleMode(): [PurpleMode, (m: PurpleMode) => void] {
  const [raw, set] = useSyncedLocal(KEYS.purpleMode, 'targets');
  return [raw === 'personal' ? 'personal' : 'targets', set];
}

/**
 * Color of a live sector against the selected targets' sector times (`targetTimes`): green is faster
 * than every target, yellow beats some, orange is slower than all; purple per `purpleMode`.
 * Without any target sector times, falls back to timingClass (purple / session best / slower).
 */
export function targetSectorClass(
  t: number | null, allTimeBest: number | null, targetTimes: Array<number | null>, sessionBest: number | null,
  purpleMode: PurpleMode = 'targets',
): string {
  if (t === null) return 'text-racing-muted';
  const personalBest = allTimeBest !== null && t < allTimeBest;
  if (purpleMode === 'personal' && personalBest) return 'text-racing-purple';
  const known = targetTimes.filter((x): x is number => x !== null);
  if (!known.length) return timingClass(t, allTimeBest, sessionBest);
  const beaten = known.filter(x => t <= x).length;
  if (beaten < known.length) return beaten > 0 ? 'text-racing-yellow' : 'text-racing-orange';
  return personalBest ? 'text-racing-purple' : 'text-racing-green';
}

/** Per-sector minimum over the laps completed this session */
export function sessionBestSectors(laps: SessionLap[]): Sectors {
  return [0, 1, 2].map(i => laps.reduce<number | null>((m, l) => {
    const v = l.invalid ? null : l.sectors[i];
    return v !== null && (m === null || v < m) ? v : m;
  }, null)) as Sectors;
}

/**
 * The lap to show sector-by-sector: the running one, or — until S1 of the new lap is done —
 * the lap just finished, so its S3 and lap time stay visible. Prefers our own record of that lap
 * (`lastLap`), which survives LMU blanking an invalidated lap.
 */
export function displayedLap(p: LiveVehicle | null, lastLap?: SessionLap): { running: boolean; sectors: Sectors; lapTime: number | null; invalid: boolean } {
  if (!p) return { running: false, sectors: [null, null, null], lapTime: null, invalid: false };
  if (time(p.currentSectorTime1) !== null) {
    return { running: true, sectors: toSectors(time(p.currentSectorTime1), time(p.currentSectorTime2), null), lapTime: time(p.timeIntoLap), invalid: !lapCounts(p) };
  }
  const finished = lastLapOf(p, lastLap);
  return { running: false, sectors: finished?.sectors ?? [null, null, null], lapTime: finished?.time ?? null, invalid: finished?.invalid ?? false };
}

/** The player's last completed lap: our record if it is that lap, else what LMU reports (assumed valid) */
export function lastLapOf(p: LiveVehicle, lastLap?: SessionLap): SessionLap | null {
  if (lastLap && lastLap.lap === p.lapsCompleted) return lastLap;
  const t = time(p.lastLapTime);
  return t === null ? null : { lap: p.lapsCompleted, time: t, sectors: toSectors(time(p.lastSectorTime1), time(p.lastSectorTime2), t), invalid: false };
}

/** Individual sector times of a reference (benchmarks scaled from `shape`) */
export function refSectors(ref: Reference | null, shape: Reference | null): Sectors {
  const splits = ref ? refSplits(ref, shape) : null;
  return ref && splits ? toSectors(splits[0], splits[1], ref.time) : [null, null, null];
}

export function sectorDeltas(mine: Sectors, target: Sectors): Sectors {
  return mine.map((s, i) => (s !== null && target[i] !== null ? s - target[i]! : null)) as Sectors;
}

/** Sum of the known sector deltas — the gap at the last completed split */
export function totalDelta(deltas: Sectors): number | null {
  const known = deltas.filter((d): d is number => d !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/** A localStorage string kept in sync between the main window and the overlay window */
function useSyncedLocal(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => lsGet(key) ?? fallback);
  useEffect(() => {
    // `storage` fires in the *other* window when one of them changes the key
    const onStorage = (e: StorageEvent) => { if (e.key === key) setValue(e.newValue ?? fallback); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, fallback]);
  return [value, (v: string) => { setValue(v); lsSet(key, v); }];
}

/** A set of ids in localStorage, synced between windows. A legacy plain-string value becomes a one-item set. */
function useSyncedSet(key: string, fallback: string[]): [Set<string>, (id: string) => void] {
  const [raw, setRaw] = useSyncedLocal(key, JSON.stringify(fallback));
  const set = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set<string>(Array.isArray(parsed) ? parsed : [String(parsed)]);
    } catch {
      return new Set<string>([raw]); // pre-multi-select versions stored one bare id
    }
  }, [raw]);
  const toggle = (id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    setRaw(JSON.stringify([...next]));
  };
  return [set, toggle];
}

/** Selected targets (Reference ids) the overlay shows a delta for, shared by the Live view and the overlay */
export function useLiveTargets() {
  return useSyncedSet(KEYS.liveTargets, ['pb']);
}

/** Targets the user hid (Reference ids), shared by the Live view and the overlay */
export function useHiddenTargets() {
  return useSyncedSet(KEYS.liveHiddenTargets, []);
}

/** Overlay sections the user switched off (ids from OverlayView's PARTS) */
export function useOverlayHiddenParts() {
  return useSyncedSet(KEYS.overlayHiddenParts, []);
}

/** The selected targets among `visible`, in its order; the first visible one if none of them is available here */
export function activeTargets(visible: Reference[], selected: Set<string>): Reference[] {
  const chosen = visible.filter(r => selected.has(r.id));
  return chosen.length ? chosen : visible.slice(0, 1);
}
