import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X } from 'lucide-react';
import { LapClock } from '../components/LapClock';
import {
  useLiveTelemetry, useLiveReferences, useLiveTarget, useHiddenTargets, displayedLap, refSectors, sectorDeltas,
  totalDelta, timingClass, sessionBestSectors,
} from '../lib/live';
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
  const [targetId, pickTarget] = useLiveTarget();
  // Read once — a fresh array each render would recompute the lap history on every poll
  const [driverNames] = useState(() => storage.loadFilters()?.selectedDrivers ?? []);
  const [benchmarksEnabled] = useState(() => storage.lsGet(storage.KEYS.benchmarks) !== '0');
  const { live, error, sessionLaps } = useLiveTelemetry();
  const { references, pb, bestSectors } = useLiveReferences(files, driverNames, benchmarksEnabled, live);

  useEffect(() => {
    storage.loadCachedFiles().then(c => { if (c) setFiles(c.files); });
    // Remember where the user dragged the window
    const win = getCurrentWindow();
    const unlisten = win.onMoved(async ({ payload }) => {
      const { x, y } = payload.toLogical(await win.scaleFactor());
      // Windows parks minimized windows at -32000 — don't reopen off-screen
      if (x < -10000 || y < -10000) return;
      storage.lsSet(storage.KEYS.overlayPosition, JSON.stringify({ x, y }));
    });
    return () => { void unlisten.then(f => f()); };
  }, []);

  const [hidden] = useHiddenTargets();
  const visible = references.filter(r => !hidden.has(r.id));
  const target = visible.find(r => r.id === targetId) ?? visible[0] ?? null;
  const p = live?.player ?? null;
  const { running, sectors: mine, lapTime } = displayedLap(p);
  const deltas = sectorDeltas(mine, refSectors(target, pb));
  const total = totalDelta(deltas);
  const sessionBests = sessionBestSectors(sessionLaps);
  const sessionBestLap = sessionLaps.length ? Math.min(...sessionLaps.map(l => l.time)) : null;
  // Running clock stays neutral; a finished lap gets gold (new PB) / green (session best) / yellow
  const lapClass = running ? 'text-white' : timingClass(lapTime, pb?.time ?? null, sessionBestLap, 'text-racing-gold');

  return (
    <div data-tauri-drag-region className="h-screen p-3 bg-racing-black border border-racing-border text-sm font-mono select-none cursor-move">
      <div data-tauri-drag-region className="flex items-center gap-2 mb-2">
        <select value={target?.id ?? ''} onChange={e => pickTarget(e.target.value)}
          className="flex-1 min-w-0 bg-racing-dark border border-racing-border text-xs text-white px-1 py-0.5 font-sans cursor-pointer">
          {visible.length === 0 && <option value="">No target for this track</option>}
          {visible.map(r => <option key={r.id} value={r.id}>{r.label} · {formatLapTime(r.time)}</option>)}
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
              <td className={`text-right pt-1 ${lapClass}`}>{running ? <LapClock value={lapTime} /> : formatLapTime(lapTime)}</td>
              <td className={`text-right text-base font-bold pt-1 ${deltaClass(total)}`}>{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
