import { useState } from 'react';
import { SortableTable, type Column } from '../components/SortableTable';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { Radio, PictureInPicture2, EyeOff, Eye, TriangleAlert } from 'lucide-react';
import { DataCardHeader } from '../components/DataCardHeader';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { RatingBadge } from '../components/RatingBadge';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { LapClock } from '../components/LapClock';
import {
  useLiveTelemetry, useLiveReferences, useLiveTargets, useHiddenTargets, activeTargets, displayedLap, lastLapOf, refSectors, sectorDeltas, totalDelta,
  sessionBestSectors, time, toggleOverlay, timingClass, targetSectorClass, type Sectors, type Reference, type SessionLap,
} from '../lib/live';
import { formatLapTime, formatDelta, formatSector, errorMessage } from '../lib/formatting';
import { ratingFromPercent } from '../lib/racepace';
import type { RaceFile } from '../lib/types';

interface LiveViewProps {
  files: RaceFile[];
  driverNames: string[];
  benchmarksEnabled: boolean;
}

type LapLimit = 'targets' | '10' | 'all';

const deltaClass = (d: number | null) =>
  d === null ? 'text-racing-muted' : d <= 0 ? 'text-racing-green' : 'text-racing-red';

export function LiveView({ files, driverNames, benchmarksEnabled }: LiveViewProps) {
  const { live, error, sessionLaps } = useLiveTelemetry();
  const { references, pb, shape, carClass, bestSectors } = useLiveReferences(files, driverNames, benchmarksEnabled, live);
  const [selected, toggleTarget] = useLiveTargets();
  const [hidden, toggleHidden] = useHiddenTargets();
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [lapLimit, setLapLimit] = useState<LapLimit>('targets');
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
  const targets = activeTargets(visible, selected);
  // Fastest selected target — the one the stat card and the session table compare against
  const target = targets[0] ?? null;
  const shown = displayedLap(player, sessionLaps[0]);
  const lastLap = lastLapOf(player, sessionLaps[0]);
  const last = lastLap?.time ?? null;
  const best = time(player.bestLapTime);
  const sessionBests = sessionBestSectors(sessionLaps);
  const alien = references.find(r => r.rating === 'Alien')?.time;
  const rate = (t: number | null) => (t !== null && alien ? ratingFromPercent(t / alien * 100) : null);
  const liveGap = totalDelta(sectorDeltas(shown.sectors, refSectors(target, shape)));
  // Invalidated laps never get purple/green — their sectors stay neutral
  const sectorClass = (s: Sectors, i: number, invalid: boolean) =>
    invalid ? 'text-racing-muted' : timingClass(s[i], bestSectors[i], sessionBests[i]);
  const lapClass = (t: number | null) => timingClass(t, pb?.time ?? null, best, 'text-racing-gold');

  // Targets always; my individual laps on request. Selected laps stay listed whatever the limit.
  const historyLaps = visible.filter(r => r.id.startsWith('lap:'));
  const shownLaps = new Set(lapLimit === 'all' ? historyLaps : lapLimit === '10' ? historyLaps.slice(0, 10) : []);
  const rows = visible.filter(r => !r.id.startsWith('lap:') || shownLaps.has(r) || selected.has(r.id));

  const sectorColumn = (i: number): Column<Reference> => ({
    key: `s${i + 1}`, label: `S${i + 1}`, align: 'right', mono: true,
    sortValue: r => refSectors(r, shape)[i],
    render: r => {
      const sec = refSectors(r, shape)[i];
      const d = sectorDeltas(shown.sectors, refSectors(r, shape))[i];
      return (
        <div className="leading-tight">
          <div className="text-racing-muted">{formatSector(sec)}</div>
          <div className={`text-xs ${deltaClass(d)}`}>{d === null ? '\u00a0' : fmt(d)}</div>
        </div>
      );
    },
  });

  const gapColumns: Column<Reference>[] = [
    {
      key: 'target', label: 'Target', width: '240px', sortValue: r => r.label,
      render: r => r.rating ? <RatingBadge rating={r.rating} size="sm" />
        : r.id === 'theoretical' ? <span className="text-racing-purple">{r.label}</span>
        : r.id.startsWith('pb') ? <span className="text-racing-gold">{r.label}</span>
        : <span className="text-white">{r.label}</span>,
    },
    sectorColumn(0), sectorColumn(1), sectorColumn(2),
    { key: 'lap', label: 'Lap', align: 'right', mono: true, sortValue: r => r.time, render: r => <span className="text-white">{formatLapTime(r.time)}</span> },
    {
      key: 'lastD', label: 'Last lap Δ', align: 'right', mono: true,
      sortValue: r => (last !== null ? last - r.time : null),
      render: r => { const d = last !== null ? last - r.time : null; return <span className={deltaClass(d)}>{fmt(d)}</span>; },
    },
    {
      key: 'bestD', label: 'Session best Δ', align: 'right', mono: true,
      sortValue: r => (best !== null ? best - r.time : null),
      render: r => { const d = best !== null ? best - r.time : null; return <span className={deltaClass(d)}>{fmt(d)}</span>; },
    },
    {
      key: 'hide', label: '', sortable: false, width: '44px', cellClass: 'px-2',
      render: r => (
        <button onClick={e => { e.stopPropagation(); toggleHidden(r.id); }} title="Hide this target"
          className="p-1 text-racing-muted/40 hover:text-racing-red cursor-pointer">
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const sessionColumns: Column<SessionLap>[] = [
    { key: 'lap', label: 'Lap', mono: true, sortValue: l => l.lap, render: l => <span className="text-racing-muted">{l.lap}</span> },
    ...[0, 1, 2].map((i): Column<SessionLap> => ({
      key: `s${i + 1}`, label: `S${i + 1}`, align: 'right', mono: true,
      sortValue: l => l.sectors[i],
      render: l => <span className={sectorClass(l.sectors, i, l.invalid)}>{formatSector(l.sectors[i])}</span>,
    })),
    {
      key: 'time', label: 'Time', align: 'right', mono: true, sortValue: l => l.time,
      render: l => <span className={l.invalid ? 'text-racing-orange' : lapClass(l.time)}>{formatLapTime(l.time)}</span>,
    },
    {
      key: 'delta', label: `Δ ${target?.label ?? 'target'}`, align: 'right', mono: true,
      sortValue: l => (target ? l.time - target.time : null),
      render: l => { const d = target ? l.time - target.time : null; return <span className={deltaClass(d)}>{fmt(d)}</span>; },
    },
    {
      key: 'rating', label: '', align: 'right', sortable: false,
      render: l => { const rating = l.invalid ? null : rate(l.time); return l.invalid ? <InvalidTag /> : rating && <RatingBadge rating={rating} size="sm" />; },
    },
  ];

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
        <StatCard label="Current lap" value={<LapClock value={time(player.timeIntoLap)} />}
          accent={shown.running && shown.invalid ? 'text-racing-orange' : undefined}
          sub={`Lap ${player.lapsCompleted + 1}${shown.running && shown.invalid ? ' · ⚠ invalid' : ''}`} />
        <StatCard label={`Δ to ${target?.label ?? 'target'}`} value={fmt(liveGap)} accent={deltaClass(liveGap)}
          sub={!shown.running ? 'last lap' : shown.sectors[1] !== null ? 'after S2' : 'after S1'} />
        <StatCard label="Last lap" value={formatLapTime(last)}
          accent={lastLap?.invalid ? 'text-racing-orange' : last !== null ? lapClass(last) : undefined}
          sub={lastLap?.invalid ? '⚠ Invalidated' : rate(last) ?? undefined} />
        <StatCard label="Session best" value={formatLapTime(best)} accent="text-racing-green" />
      </div>

      <div className="data-card carbon-fiber">
        <DataCardHeader title={<>{shown.running ? 'CURRENT LAP' : 'LAST LAP'}{shown.invalid && <InvalidTag />}</>} />
        <div className="grid grid-cols-4 divide-x divide-racing-border font-mono">
          {shown.sectors.map((sec, i) => (
            <div key={i} className="px-4 py-3 text-center">
              <div className="text-[10px] font-sans uppercase tracking-[0.12em] text-racing-muted">S{i + 1}</div>
              <div className={`text-xl font-bold ${shown.invalid ? 'text-racing-muted'
                : targetSectorClass(sec, bestSectors[i], targets.map(t => refSectors(t, shape)[i]), sessionBests[i])}`}>{formatSector(sec)}</div>
            </div>
          ))}
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] font-sans uppercase tracking-[0.12em] text-racing-muted">Lap</div>
            <div className={`text-xl font-bold ${shown.invalid ? 'text-racing-orange' : shown.running ? 'text-white' : lapClass(shown.lapTime)}`}>
              {shown.running ? <LapClock value={shown.lapTime} /> : formatLapTime(shown.lapTime)}
            </div>
          </div>
        </div>
      </div>

      <div className="data-card carbon-fiber">
        <DataCardHeader title="GAP TO TARGETS">
          <span className="text-racing-muted text-[10px] font-sans hidden md:inline">Click rows to pick targets — the overlay shows a delta for each</span>
          <FilterButtonGroup
            options={[{ value: 'targets' as LapLimit, label: 'Targets' }, { value: '10' as LapLimit, label: '+ Top 10 laps' }, { value: 'all' as LapLimit, label: '+ All laps' }]}
            value={lapLimit}
            onChange={setLapLimit}
          />
        </DataCardHeader>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-racing-muted text-sm">No laps or benchmarks for this track and class yet.</p>
        ) : (
          <SortableTable<Reference>
            columns={gapColumns}
            data={rows}
            rowKey={r => r.id}
            onRowClick={r => toggleTarget(r.id)}
            rowClass={r => (targets.includes(r) ? 'bg-racing-red/[0.06] shadow-[inset_2px_0_0_var(--color-racing-red)]' : '')}
          />
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
        <div className="data-card carbon-fiber">
          <DataCardHeader title="THIS SESSION" />
          <SortableTable<SessionLap> columns={sessionColumns} data={sessionLaps} rowKey={l => String(l.lap)} />
        </div>
      )}

      {references.some(r => r.rating) && <OhneSpeedCredit />}
    </div>
  );
}

const fmt = (d: number | null) => (d === null ? '--' : formatDelta(d));

/** Orange warning chip for invalidated laps (track limits etc.) — the time is still shown next to it */
function InvalidTag() {
  return (
    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wide text-racing-orange bg-racing-orange/10 border border-racing-orange/30">
      <TriangleAlert className="w-3 h-3" /> Invalid
    </span>
  );
}
