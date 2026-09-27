import { useEffect, useRef } from 'react';
import { formatLapTime } from '../lib/formatting';

// ponytail: fixed staleness window, independent of how often the game refreshes timeIntoLap
const STALE_S = 0.5;

/**
 * Running lap time, advanced locally every frame between telemetry polls. Writes to the DOM
 * directly so the 60fps tick doesn't re-render the view. Freezes (no extrapolation) once the
 * game stops sending new values — paused, in the garage, or back to menus.
 */
export function LapClock({ value, className }: { value: number | null; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // at: 0 → treated as stale until the first effect stamps it
  const sample = useRef({ value, at: 0 });

  useEffect(() => { sample.current = { value, at: performance.now() }; }, [value]);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      const { value: v, at } = sample.current;
      const elapsed = (performance.now() - at) / 1000;
      // No change for STALE_S → the clock isn't running in-game (may snap back by up to STALE_S once)
      const live = v !== null && elapsed < STALE_S;
      if (ref.current) ref.current.textContent = formatLapTime(v === null ? null : live ? v + elapsed : v);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <span ref={ref} className={className}>{formatLapTime(value)}</span>;
}
