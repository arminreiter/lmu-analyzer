import { useState, useEffect, useRef, type ReactNode } from 'react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { X, Settings2 } from 'lucide-react';
import { LapClock } from '../components/LapClock';
import {
  useLiveTelemetry, useLiveReferences, useLiveTargets, useHiddenTargets, activeTargets, displayedLap, lastLapOf,
  refSectors, sectorDeltas, totalDelta, timingClass, targetSectorClass, sessionBestSectors, time,
} from '../lib/live';
import { formatLapTime, formatDelta } from '../lib/formatting';
import * as storage from '../lib/storage';
import type { RaceFile } from '../lib/types';

const deltaText = (d: number | null) =>
  d === null ? 'text-racing-muted' : d <= 0 ? 'text-racing-green' : 'text-racing-red';
const deltaBar = (d: number | null) =>
  d === null ? 'bg-white/10' : d <= 0 ? 'bg-racing-green' : 'bg-racing-red';

/** timingClass text colors → sector bar fills (literal class names so Tailwind generates them) */
const SECTOR_FILL: Record<string, string> = {
  'text-racing-purple': 'bg-racing-purple',
  'text-racing-green': 'bg-racing-green',
  'text-racing-yellow': 'bg-racing-yellow',
  'text-racing-orange': 'bg-racing-orange',
};

/**
 * Always-on-top overlay window (`index.html?overlay`), styled after LMU's own timing widget:
 * lap / last / best / current, a sector bar in timing colors, then one delta per selected target.
 * Runs standalone: reads the cached files and driver selection the main window saved and polls LMU itself.
 */
export function OverlayView() {
  const [files, setFiles] = useState<RaceFile[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, toggleTarget] = useLiveTargets();
  const [hidden] = useHiddenTargets();
  // Read once — a fresh array each render would recompute the lap history on every poll
  const [driverNames] = useState(() => storage.loadFilters()?.selectedDrivers ?? []);
  const [benchmarksEnabled] = useState(() => storage.lsGet(storage.KEYS.benchmarks) !== '0');
  const { live, error, sessionLaps } = useLiveTelemetry();
  const { references, pb, shape, bestSectors } = useLiveReferences(files, driverNames, benchmarksEnabled, live);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    storage.loadCachedFiles().then(c => { if (c) setFiles(c.files); });
    // Let the game show through around the rounded card
    document.documentElement.style.background = document.body.style.background = 'transparent';
    const win = getCurrentWindow();
    // Remember where the user dragged the window
    const unlisten = win.onMoved(async ({ payload }) => {
      const { x, y } = payload.toLogical(await win.scaleFactor());
      // Windows parks minimized windows at -32000 — don't reopen off-screen
      if (x < -10000 || y < -10000) return;
      storage.lsSet(storage.KEYS.overlayPosition, JSON.stringify({ x, y }));
    });
    // Window follows the card's size (targets added/removed, settings opened)
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.target.getBoundingClientRect();
      void win.setSize(new LogicalSize(Math.ceil(width), Math.ceil(height)));
    });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); void unlisten.then(f => f()); };
  }, []);

  // Individual history laps are picked in the Live view; here only the selected ones are listed
  const visible = references.filter(r => !hidden.has(r.id) && (!r.id.startsWith('lap:') || selected.has(r.id)));
  const targets = activeTargets(visible, selected);
  const targetSectors = targets.map(t => refSectors(t, shape));

  const p = live?.player ?? null;
  const shown = displayedLap(p, sessionLaps[0]);
  const lastLap = p ? lastLapOf(p, sessionLaps[0]) : null;
  const sessionBests = sessionBestSectors(sessionLaps);
  const best = time(p?.bestLapTime);
  const currentInvalid = shown.running && shown.invalid;
  // Last lap: orange if invalidated, else gold (new PB) / green (session best) / yellow
  const lastClass = lastLap?.invalid ? 'text-racing-orange'
    : lastLap ? timingClass(lastLap.time, pb?.time ?? null, best, 'text-racing-gold') : 'text-white';

  return (
    <div ref={root} data-tauri-drag-region
      className="group relative w-[240px] rounded-lg overflow-hidden bg-[#2a2a2e]/95 text-white font-sans font-bold select-none cursor-move">
      <div className="absolute top-1 right-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setShowSettings(v => !v)} className="p-1 rounded bg-black/60 text-racing-muted hover:text-white cursor-pointer" title="Choose targets">
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => void getCurrentWindow().close()} className="p-1 rounded bg-black/60 text-racing-muted hover:text-racing-red cursor-pointer" title="Close overlay">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSettings && (
        <div className="px-3 py-2 border-b border-white/10 bg-black/40 cursor-default text-xs font-medium">
          <div className="text-[10px] uppercase tracking-wider text-racing-muted mb-1">Targets</div>
          {visible.length === 0 && <div className="text-racing-muted">No targets for this track yet</div>}
          {visible.map(r => (
            <label key={r.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleTarget(r.id)} className="accent-racing-red" />
              <span className="flex-1 truncate">{r.label}</span>
              <span className="font-mono text-racing-muted">{formatLapTime(r.time)}</span>
            </label>
          ))}
        </div>
      )}

      {!p ? (
        <div data-tauri-drag-region className="px-3 py-4 text-sm text-racing-muted">{error ? 'Waiting for LMU…' : 'Get in the car…'}</div>
      ) : (
        <>
          <Row label="Lap">{p.lapsCompleted + 1}</Row>
          <Row label="Last"><span className={lastClass}>{formatLapTime(lastLap?.time ?? null)}</span></Row>
          <Row label="Best"><span className="text-racing-green">{formatLapTime(best)}</span></Row>
          <Row label={currentInvalid ? '⚠ Current' : 'Current'} labelClass={currentInvalid ? 'text-racing-orange' : undefined}>
            <LapClock value={time(p.timeIntoLap)} className={currentInvalid ? 'text-racing-orange' : undefined} />
          </Row>

          {/* Sector bar: timing colors for completed sectors of the running (or just-finished) lap */}
          <div data-tauri-drag-region className="grid grid-cols-3 gap-px bg-black/40 text-[10px] text-center">
            {shown.sectors.map((s, i) => {
              const fill = s === null ? 'bg-white/10 text-racing-muted'
                : shown.invalid ? 'bg-racing-muted/50 text-white'
                : `${SECTOR_FILL[targetSectorClass(s, bestSectors[i], targetSectors.map(ts => ts[i]), sessionBests[i])] ?? 'bg-white/10'} text-black`;
              return <div key={i} data-tauri-drag-region className={`py-0.5 ${fill}`}>S{i + 1}</div>;
            })}
          </div>

          {targets.length === 0 && (
            <div data-tauri-drag-region className="px-3 py-2 text-xs text-racing-muted font-medium">No target for this track</div>
          )}
          {targets.map(t => {
            const deltas = sectorDeltas(shown.sectors, refSectors(t, shape));
            const total = totalDelta(deltas);
            return (
              <div key={t.id} data-tauri-drag-region className="flex items-center gap-2 pl-3 pr-2 py-1.5 border-t border-white/10">
                <div data-tauri-drag-region className="flex-1 min-w-0">
                  <div data-tauri-drag-region className="text-[10px] uppercase tracking-wide text-racing-muted truncate">{t.label}</div>
                  <div data-tauri-drag-region className="flex gap-2 text-[10px] font-mono font-medium tabular-nums">
                    {deltas.map((d, i) => (
                      <span key={i} className={deltaText(d)}>{d === null ? `S${i + 1} —` : formatDelta(d)}</span>
                    ))}
                  </div>
                </div>
                <div data-tauri-drag-region className={`text-2xl tabular-nums ${deltaText(total)}`}>{total === null ? '--' : formatDelta(total)}</div>
                <div className={`w-1 self-stretch rounded-sm ${deltaBar(total)}`} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Row({ label, labelClass, children }: { label: string; labelClass?: string; children: ReactNode }) {
  return (
    <div data-tauri-drag-region className="flex items-center justify-between px-3 py-1 border-b border-white/10 text-[15px] tabular-nums">
      <span data-tauri-drag-region className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
