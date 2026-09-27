import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Radio } from 'lucide-react';
import { DataCardHeader } from '../components/DataCardHeader';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { RatingBadge } from '../components/RatingBadge';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { useBenchmarks } from '../lib/useBenchmarks';
import { getAllLaps } from '../lib/analytics';
import { resolveCarClass } from '../lib/parser';
import { formatLapTime, formatDelta, errorMessage } from '../lib/formatting';
import { mapTrackName, ratingFromPercent, type PaceBenchmark, type PaceRating } from '../lib/racepace';
import type { RaceFile, PersonalBest } from '../lib/types';

interface LiveViewProps {
  files: RaceFile[];
  driverNames: string[];
  benchmarksEnabled: boolean;
}

/** Subset of LMU's /rest/watch/standings entry. Sector fields are cumulative (S1, S1+S2); unset times are <= 0. */
interface LiveVehicle {
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
}

interface LiveState {
  player: LiveVehicle | null;
  trackName: string;
  session: string;
}

/** A reference lap: total time plus cumulative splits (S1, S1+S2) when known */
interface Reference {
  label: string;
  time: number;
  splits: [number, number] | null;
  rating?: PaceRating;
}

// ponytail: 250ms polling of localhost; switch to LMU shared memory if we ever need per-frame data
const POLL_MS = 250;

const TIERS: Array<[keyof PaceBenchmark['racePace'], PaceRating]> =
  [['alien', 'Alien'], ['competitive', 'Competitive'], ['good', 'Good'], ['midpack', 'Midpack'], ['tailEnder', 'Tail-ender'], ['offline', 'Offline']];

const time = (v: number | undefined) => (v && v > 0 ? v : null);

const lapSplits = (lap: PersonalBest): [number, number] | null =>
  lap.sector1 !== null && lap.sector2 !== null ? [lap.sector1, lap.sector1 + lap.sector2] : null;

const deltaClass = (d: number | null) =>
  d === null ? 'text-racing-muted' : d <= 0 ? 'text-racing-green' : 'text-racing-red';

/**
 * Gap of the running lap to `ref` at the last completed sector. References without their own
 * splits (benchmarks) borrow the shape of `shape` (the PB lap), scaled to the reference time.
 */
function liveDelta(current: { s1: number | null; s2: number | null }, ref: Reference, shape: Reference | null): number | null {
  const idx = current.s2 !== null ? 1 : current.s1 !== null ? 0 : null;
  if (idx === null) return null;
  const splits = ref.splits ?? (shape?.splits ? shape.splits.map(s => s * ref.time / shape.time) : null);
  if (!splits) return null;
  return (idx === 1 ? current.s2! : current.s1!) - splits[idx];
}

export function LiveView({ files, driverNames, benchmarksEnabled }: LiveViewProps) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionLaps, setSessionLaps] = useState<Array<{ lap: number; time: number }>>([]);
  const lastLapsCompleted = useRef<number | null>(null);
  const { benchmarkMap } = useBenchmarks();

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
        // Collect laps completed while the view is open; a lower lap count means a new session
        const prev = lastLapsCompleted.current;
        if (me && prev !== null && me.lapsCompleted < prev) setSessionLaps([]);
        else if (me && prev !== null && me.lapsCompleted > prev && time(me.lastLapTime) !== null) {
          setSessionLaps(laps => [{ lap: me.lapsCompleted, time: me.lastLapTime }, ...laps]);
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

  const player = live?.player ?? null;

  const trackName = live?.trackName ?? '';
  const carClass = player ? resolveCarClass(player.carClass) : null;
  const vehicleName = player?.vehicleName ?? '';

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
      if (carLaps[0]) refs.push({ label: `My PB · ${carLaps[0].carType}`, time: carLaps[0].lapTime, splits: lapSplits(carLaps[0]) });
      if (history.laps[0] && history.laps[0] !== carLaps[0]) {
        refs.push({ label: `My PB · ${history.laps[0].carType}`, time: history.laps[0].lapTime, splits: lapSplits(history.laps[0]) });
      }
      const pool = carLaps.length ? carLaps : history.laps;
      const min = (pick: (l: PersonalBest) => number | null) =>
        pool.reduce<number | null>((m, l) => { const v = pick(l); return v !== null && (m === null || v < m) ? v : m; }, null);
      const [s1, s2, s3] = [min(l => l.sector1), min(l => l.sector2), min(l => l.sector3)];
      if (s1 !== null && s2 !== null && s3 !== null) refs.push({ label: 'Theoretical best', time: s1 + s2 + s3, splits: [s1, s1 + s2] });
    }
    const benchmark = benchmarksEnabled && carClass && benchmarkMap
      ? benchmarkMap.get(`${mapTrackName(trackName, trackName)}|${carClass}`)
      : undefined;
    if (benchmark) {
      for (const [key, rating] of TIERS) refs.push({ label: rating, time: benchmark.racePace[key], splits: null, rating });
    }
    return refs;
  }, [history, benchmarkMap, benchmarksEnabled, carClass, trackName]);

  if (!player) {
    return (
      <div className="data-card carbon-fiber p-10 text-center">
        <Radio className="w-8 h-8 mx-auto mb-3 text-racing-muted animate-pulse" />
        <p className="text-lg text-white">Waiting for Le Mans Ultimate…</p>
        <p className="text-sm text-racing-muted mt-1">
          {error ? 'Game not reachable — start LMU and get in the car.' : 'Connected — join a session and drive out.'}
        </p>
      </div>
    );
  }

  const pb = references.find(r => r.splits && !r.rating) ?? null;
  const current = { s1: time(player.currentSectorTime1), s2: time(player.currentSectorTime2) };
  const last = time(player.lastLapTime);
  const best = time(player.bestLapTime);
  const alien = references.find(r => r.rating === 'Alien')?.time;
  const rate = (t: number | null) => (t !== null && alien ? ratingFromPercent(t / alien * 100) : null);
  const pbDelta = pb ? liveDelta(current, pb, pb) : null;

  return (
    <div className="space-y-6">
      <div className="data-card carbon-fiber px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-racing-green text-xs font-bold tracking-[0.1em]">
          <span className="w-2 h-2 bg-racing-green rounded-full animate-pulse" /> LIVE
        </span>
        <span className="text-white font-medium">{trackName}</span>
        <span className="text-racing-muted text-sm">{player.vehicleName}</span>
        {carClass && <ClassBadge carClass={carClass} />}
        <span className="ml-auto text-racing-muted text-xs uppercase">{live?.session}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current lap" value={formatLapTime(time(player.timeIntoLap))} sub={`Lap ${player.lapsCompleted + 1}`} />
        <StatCard label="Live Δ to PB" value={fmt(pbDelta)} accent={deltaClass(pbDelta)}
          sub={current.s2 !== null ? 'after S2' : current.s1 !== null ? 'after S1' : 'waiting for S1'} />
        <StatCard label="Last lap" value={formatLapTime(last)} sub={rate(last) ?? undefined} />
        <StatCard label="Session best" value={formatLapTime(best)} accent="text-racing-green" />
      </div>

      <div className="data-card carbon-fiber overflow-hidden">
        <DataCardHeader title="GAP TO TARGETS" />
        {references.length === 0 ? (
          <p className="px-5 py-6 text-racing-muted text-sm">No laps or benchmarks for this track and class yet.</p>
        ) : (
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-racing-muted text-[10px] uppercase tracking-[0.1em]">
                <th className="text-left px-5 py-2 font-medium">Target</th>
                <th className="text-right px-5 py-2 font-medium">Time</th>
                <th className="text-right px-5 py-2 font-medium">Live Δ</th>
                <th className="text-right px-5 py-2 font-medium">Last lap Δ</th>
                <th className="text-right px-5 py-2 font-medium">Session best Δ</th>
              </tr>
            </thead>
            <tbody>
              {references.map(ref => {
                const liveD = liveDelta(current, ref, pb);
                const lastD = last !== null ? last - ref.time : null;
                const bestD = best !== null ? best - ref.time : null;
                return (
                  <tr key={ref.label} className="border-t border-racing-border">
                    <td className="px-5 py-2 font-sans">
                      {ref.rating ? <RatingBadge rating={ref.rating} size="sm" />
                        : <span className={ref.label === 'Theoretical best' ? 'text-racing-purple' : 'text-racing-gold'}>{ref.label}</span>}
                    </td>
                    <td className="text-right px-5 py-2 text-white">{formatLapTime(ref.time)}</td>
                    <td className={`text-right px-5 py-2 ${deltaClass(liveD)}`}>{fmt(liveD)}</td>
                    <td className={`text-right px-5 py-2 ${deltaClass(lastD)}`}>{fmt(lastD)}</td>
                    <td className={`text-right px-5 py-2 ${deltaClass(bestD)}`}>{fmt(bestD)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {sessionLaps.length > 0 && (
        <div className="data-card carbon-fiber overflow-hidden">
          <DataCardHeader title="THIS SESSION" />
          <table className="w-full text-sm font-mono">
            <tbody>
              {sessionLaps.map(({ lap, time: t }) => {
                const d = pb ? t - pb.time : null;
                const rating = rate(t);
                return (
                  <tr key={lap} className="border-t border-racing-border first:border-t-0">
                    <td className="px-5 py-2 text-racing-muted">Lap {lap}</td>
                    <td className={`px-5 py-2 text-right ${t === best ? 'text-racing-green' : 'text-white'}`}>{formatLapTime(t)}</td>
                    <td className={`px-5 py-2 text-right ${deltaClass(d)}`}>{fmt(d)}</td>
                    <td className="px-5 py-2 text-right">{rating && <RatingBadge rating={rating} size="sm" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {references.some(r => r.rating) && <OhneSpeedCredit />}
    </div>
  );
}

const fmt = (d: number | null) => (d === null ? '--' : formatDelta(d));
