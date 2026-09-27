import { useState } from 'react';
import { Radio, PictureInPicture2, EyeOff, Eye } from 'lucide-react';
import { DataCardHeader } from '../components/DataCardHeader';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { RatingBadge } from '../components/RatingBadge';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { LapClock } from '../components/LapClock';
import {
  useLiveTelemetry, useLiveReferences, useLiveTarget, useHiddenTargets, displayedLap, refSectors, sectorDeltas, totalDelta,
  sessionBestSectors, time, toggleOverlay, timingClass, type Sectors,
} from '../lib/live';
import { formatLapTime, formatDelta, formatSector, errorMessage } from '../lib/formatting';
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
  const { references, pb, carClass, bestSectors } = useLiveReferences(files, driverNames, benchmarksEnabled, live);
  const [targetId, setTargetId] = useLiveTarget();
  const [hidden, toggleHidden] = useHiddenTargets();
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const openOverlay = () => { setOverlayError(null); toggleOverlay().catch(e => setOverlayError(errorMessage(e))); };
  const overlayErrorNote = overlayError && <p className="text-racing-red text-xs mt-2">Overlay failed: {overlayError}</p>;
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
        <button onClick={openOverlay} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-racing-muted hover:text-racing-green border border-racing-border transition-colors cursor-pointer">
          <PictureInPicture2 className="w-3.5 h-3.5" /> Overlay
        </button>
        {overlayErrorNote}
      </div>
    );
  }

  const visible = references.filter(r => !hidden.has(r.id));
  const hiddenRefs = references.filter(r => hidden.has(r.id));
  const target = visible.find(r => r.id === targetId) ?? visible[0] ?? null;
  const shown = displayedLap(player);
  const last = time(player.lastLapTime);
  const best = time(player.bestLapTime);
  const sessionBests = sessionBestSectors(sessionLaps);
  const alien = references.find(r => r.rating === 'Alien')?.time;
  const rate = (t: number | null) => (t !== null && alien ? ratingFromPercent(t / alien * 100) : null);
  const liveGap = totalDelta(sectorDeltas(shown.sectors, refSectors(target, pb)));
  const sectorClass = (s: Sectors, i: number) => timingClass(s[i], bestSectors[i], sessionBests[i]);
  const lapClass = (t: number | null) => timingClass(t, pb?.time ?? null, best, 'text-racing-gold');

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
        <button onClick={openOverlay} title="Show/hide the always-on-top overlay"
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-racing-muted hover:text-racing-green border border-racing-border transition-colors cursor-pointer">
          <PictureInPicture2 className="w-3.5 h-3.5" /> Overlay
        </button>
        {overlayError && <div className="basis-full">{overlayErrorNote}</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current lap" value={<LapClock value={time(player.timeIntoLap)} />} sub={`Lap ${player.lapsCompleted + 1}`} />
        <StatCard label={`Δ to ${target?.label ?? 'target'}`} value={fmt(liveGap)} accent={deltaClass(liveGap)}
          sub={!shown.running ? 'last lap' : shown.sectors[1] !== null ? 'after S2' : 'after S1'} />
        <StatCard label="Last lap" value={formatLapTime(last)} accent={last !== null ? lapClass(last) : undefined} sub={rate(last) ?? undefined} />
        <StatCard label="Session best" value={formatLapTime(best)} accent="text-racing-green" />
      </div>

      <div className="data-card carbon-fiber overflow-x-auto">
        <DataCardHeader title="GAP TO TARGETS">
          <span className="text-racing-muted text-[10px] font-sans">Click a row to set the target (also used by the overlay)</span>
        </DataCardHeader>
        {references.length === 0 ? (
          <p className="px-5 py-6 text-racing-muted text-sm">No laps or benchmarks for this track and class yet.</p>
        ) : (
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-racing-muted text-[10px] uppercase tracking-[0.1em]">
                <th className="text-left px-4 py-2 font-medium">Target</th>
                <th className="text-right px-4 py-2 font-medium">S1</th>
                <th className="text-right px-4 py-2 font-medium">S2</th>
                <th className="text-right px-4 py-2 font-medium">S3</th>
                <th className="text-right px-4 py-2 font-medium">Lap</th>
                <th className="text-right px-4 py-2 font-medium">Last lap Δ</th>
                <th className="text-right px-4 py-2 font-medium">Session best Δ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-racing-border bg-white/[0.02]">
                <td className="px-4 py-2 font-sans text-white">{shown.running ? 'Current lap' : 'Last lap'}</td>
                {shown.sectors.map((sec, i) => (
                  <td key={i} className={`text-right px-4 py-2 ${sectorClass(shown.sectors, i)}`}>{formatSector(sec)}</td>
                ))}
                <td className={`text-right px-4 py-2 ${shown.running ? 'text-white' : lapClass(shown.lapTime)}`}>
                  {shown.running ? <LapClock value={shown.lapTime} /> : formatLapTime(shown.lapTime)}
                </td>
                <td /><td /><td />
              </tr>
              {visible.map(ref => {
                const refSec = refSectors(ref, pb);
                const deltas = sectorDeltas(shown.sectors, refSec);
                const lastD = last !== null ? last - ref.time : null;
                const bestD = best !== null ? best - ref.time : null;
                const selected = ref.id === target?.id;
                return (
                  <tr key={ref.id} onClick={() => setTargetId(ref.id)}
                    className={`border-t border-racing-border cursor-pointer hover:bg-white/[0.03] ${selected ? 'bg-racing-red/[0.06] shadow-[inset_2px_0_0_var(--color-racing-red)]' : ''}`}>
                    <td className="px-4 py-2 font-sans">
                      {ref.rating ? <RatingBadge rating={ref.rating} size="sm" />
                        : <span className={ref.id === 'theoretical' ? 'text-racing-purple' : 'text-racing-gold'}>{ref.label}</span>}
                    </td>
                    {refSec.map((sec, i) => (
                      <td key={i} className="text-right px-4 py-1.5 leading-tight">
                        <div className="text-racing-muted">{formatSector(sec)}</div>
                        <div className={`text-xs ${deltaClass(deltas[i])}`}>{deltas[i] === null ? '\u00a0' : fmt(deltas[i])}</div>
                      </td>
                    ))}
                    <td className="text-right px-4 py-2 text-white">{formatLapTime(ref.time)}</td>
                    <td className={`text-right px-4 py-2 ${deltaClass(lastD)}`}>{fmt(lastD)}</td>
                    <td className={`text-right px-4 py-2 ${deltaClass(bestD)}`}>{fmt(bestD)}</td>
                    <td className="pr-3">
                      <button onClick={e => { e.stopPropagation(); toggleHidden(ref.id); }} title="Hide this target"
                        className="p-1 text-racing-muted/40 hover:text-racing-red cursor-pointer">
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {hiddenRefs.length > 0 && (
          <div className="px-4 py-2 border-t border-racing-border flex flex-wrap items-center gap-2 text-xs">
            <span className="text-racing-muted">Hidden:</span>
            {hiddenRefs.map(ref => (
              <button key={ref.id} onClick={() => toggleHidden(ref.id)} title="Show again"
                className="flex items-center gap-1 px-2 py-0.5 border border-racing-border text-racing-muted hover:text-white cursor-pointer">
                <Eye className="w-3 h-3" /> {ref.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {sessionLaps.length > 0 && (
        <div className="data-card carbon-fiber overflow-x-auto">
          <DataCardHeader title="THIS SESSION" />
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-racing-muted text-[10px] uppercase tracking-[0.1em]">
                <th className="text-left px-4 py-2 font-medium">Lap</th>
                <th className="text-right px-4 py-2 font-medium">S1</th>
                <th className="text-right px-4 py-2 font-medium">S2</th>
                <th className="text-right px-4 py-2 font-medium">S3</th>
                <th className="text-right px-4 py-2 font-medium">Time</th>
                <th className="text-right px-4 py-2 font-medium">Δ {target?.label ?? 'target'}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sessionLaps.map(({ lap, time: t, sectors }) => {
                const d = target ? t - target.time : null;
                const rating = rate(t);
                return (
                  <tr key={lap} className="border-t border-racing-border">
                    <td className="px-4 py-2 text-racing-muted">{lap}</td>
                    {sectors.map((sec, i) => (
                      <td key={i} className={`px-4 py-2 text-right ${sectorClass(sectors, i)}`}>{formatSector(sec)}</td>
                    ))}
                    <td className={`px-4 py-2 text-right ${lapClass(t)}`}>{formatLapTime(t)}</td>
                    <td className={`px-4 py-2 text-right ${deltaClass(d)}`}>{fmt(d)}</td>
                    <td className="px-4 py-2 text-right">{rating && <RatingBadge rating={rating} size="sm" />}</td>
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
