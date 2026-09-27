import { Radio, PictureInPicture2 } from 'lucide-react';
import { DataCardHeader } from '../components/DataCardHeader';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { RatingBadge } from '../components/RatingBadge';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { useLiveTelemetry, useLiveReferences, liveDelta, time, toggleOverlay, timingClass } from '../lib/live';
import { formatLapTime, formatDelta } from '../lib/formatting';
import { ratingFromPercent } from '../lib/racepace';
import type { RaceFile } from '../lib/types';

interface LiveViewProps {
  files: RaceFile[];
  driverNames: string[];
  benchmarksEnabled: boolean;
}

const deltaClass = (d: number | null) =>
  d === null ? 'text-racing-muted' : d <= 0 ? 'text-racing-green' : 'text-racing-red';

export function LiveView({ files, driverNames, benchmarksEnabled }: LiveViewProps) {
  const { live, error, sessionLaps } = useLiveTelemetry();
  const { references, pb, carClass } = useLiveReferences(files, driverNames, benchmarksEnabled, live);
  const player = live?.player ?? null;
  const trackName = live?.trackName ?? '';

  if (!player) {
    return (
      <div className="data-card carbon-fiber p-10 text-center">
        <Radio className="w-8 h-8 mx-auto mb-3 text-racing-muted animate-pulse" />
        <p className="text-lg text-white">Waiting for Le Mans Ultimate…</p>
        <p className="text-sm text-racing-muted mt-1">
          {error ? 'Game not reachable — start LMU and get in the car.' : 'Connected — join a session and drive out.'}
        </p>
        <button onClick={() => void toggleOverlay()} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-racing-muted hover:text-racing-green border border-racing-border transition-colors cursor-pointer">
          <PictureInPicture2 className="w-3.5 h-3.5" /> Overlay
        </button>
      </div>
    );
  }

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
        <button onClick={() => void toggleOverlay()} title="Show/hide the always-on-top overlay"
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-racing-muted hover:text-racing-green border border-racing-border transition-colors cursor-pointer">
          <PictureInPicture2 className="w-3.5 h-3.5" /> Overlay
        </button>
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
                    <td className={`px-5 py-2 text-right ${timingClass(t, pb?.time ?? null, best, 'text-racing-gold')}`}>{formatLapTime(t)}</td>
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
