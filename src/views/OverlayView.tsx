import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X } from 'lucide-react';
import { useLiveTelemetry, useLiveReferences, refSplits, toSectors, time, timingClass, sessionBestSectors, type Sectors } from '../lib/live';
import { formatLapTime, formatDelta, formatSector } from '../lib/formatting';
import * as storage from '../lib/storage';
import type { RaceFile } from '../lib/types';

const deltaClass = (d: number | null) =>
  d === null ? 'text-racing-muted' : d <= 0 ? 'text-racing-green' : 'text-racing-red';

const fmt = (d: number | null) => (d === null ? '' : formatDelta(d));

/**
 * Always-on-top overlay window (`index.html?overlay`). Runs standalone: reads the cached files and
 * driver selection the main window saved, polls LMU itself, and compares each sector to one chosen target.
 */
export function OverlayView() {
  const [files, setFiles] = useState<RaceFile[]>([]);
  const [targetId, setTargetId] = useState(() => storage.lsGet(storage.KEYS.overlayTarget) ?? 'pb');
  // Read once — a fresh array each render would recompute the lap history on every poll
  const [driverNames] = useState(() => storage.loadFilters()?.selectedDrivers ?? []);
  const [benchmarksEnabled] = useState(() => storage.lsGet(storage.KEYS.benchmarks) !== '0');
  const { live, error, sessionLaps } = useLiveTelemetry();
  const { references, pb, bestSectors } = useLiveReferences(files, driverNames, benchmarksEnabled, live);

  useEffect(() => {
    storage.loadCachedFiles().then(c => { if (c) setFiles(c.files); });
    // Let the game show through, and remember where the user dragged the window
    document.documentElement.style.background = document.body.style.background = 'transparent';
    const win = getCurrentWindow();
    const unlisten = win.onMoved(async ({ payload }) => {
      const { x, y } = payload.toLogical(await win.scaleFactor());
      storage.lsSet(storage.KEYS.overlayPosition, JSON.stringify({ x, y }));
    });
    return () => { void unlisten.then(f => f()); };
  }, []);

  const pickTarget = (id: string) => { setTargetId(id); storage.lsSet(storage.KEYS.overlayTarget, id); };

  const target = references.find(r => r.id === targetId) ?? references[0] ?? null;
  const splits = target ? refSplits(target, pb) : null;
  const targetSectors: Sectors = target && splits ? toSectors(splits[0], splits[1], target.time) : [null, null, null];

  // Until S1 of the new lap is done, keep showing the lap just finished (so S3 is visible)
  const p = live?.player ?? null;
  const running = p !== null && time(p.currentSectorTime1) !== null;
  const mine: Sectors = !p ? [null, null, null]
    : running ? toSectors(time(p.currentSectorTime1), time(p.currentSectorTime2), null)
    : toSectors(time(p.lastSectorTime1), time(p.lastSectorTime2), time(p.lastLapTime));
  const deltas = mine.map((s, i) => (s !== null && targetSectors[i] !== null ? s - targetSectors[i]! : null));
  const known = deltas.filter((d): d is number => d !== null);
  const total = known.length ? known.reduce((a, b) => a + b, 0) : null;
  const sessionBests = sessionBestSectors(sessionLaps);
  const sessionBestLap = sessionLaps.length ? Math.min(...sessionLaps.map(l => l.time)) : null;
  const lapTime = running ? time(p.timeIntoLap) : time(p?.lastLapTime);
  // Running clock stays neutral; a finished lap gets gold (new PB) / green (session best) / yellow
  const lapClass = running ? 'text-white' : timingClass(lapTime, pb?.time ?? null, sessionBestLap, 'text-racing-gold');

  return (
    <div data-tauri-drag-region className="h-screen p-3 bg-racing-black/85 border border-racing-border text-sm font-mono select-none cursor-move">
      <div data-tauri-drag-region className="flex items-center gap-2 mb-2">
        <select value={target?.id ?? ''} onChange={e => pickTarget(e.target.value)}
          className="flex-1 min-w-0 bg-racing-dark border border-racing-border text-xs text-white px-1 py-0.5 font-sans cursor-pointer">
          {references.length === 0 && <option value="">No target for this track</option>}
          {references.map(r => <option key={r.id} value={r.id}>{r.label} · {formatLapTime(r.time)}</option>)}
        </select>
        <button onClick={() => void getCurrentWindow().close()} className="text-racing-muted hover:text-racing-red cursor-pointer" title="Close overlay">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!p ? (
        <p data-tauri-drag-region className="text-racing-muted text-xs font-sans">{error ? 'Waiting for LMU…' : 'Get in the car…'}</p>
      ) : (
        <table data-tauri-drag-region className="w-full">
          <tbody>
            {mine.map((s, i) => (
              <tr key={i} data-tauri-drag-region>
                <td className="text-racing-muted pr-2">S{i + 1}</td>
                <td className={`text-right ${timingClass(s, bestSectors[i], sessionBests[i])}`}>{formatSector(s)}</td>
                <td className={`text-right w-20 ${deltaClass(deltas[i])}`}>{fmt(deltas[i])}</td>
              </tr>
            ))}
            <tr data-tauri-drag-region className="border-t border-racing-border">
              <td className="text-racing-muted pr-2 pt-1">LAP</td>
              <td className={`text-right pt-1 ${lapClass}`}>{formatLapTime(lapTime)}</td>
              <td className={`text-right text-base font-bold pt-1 ${deltaClass(total)}`}>{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
