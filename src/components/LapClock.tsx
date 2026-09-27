import { useEffect, useRef } from 'react';
import { formatLapTime } from '../lib/formatting';

// ponytail: fixed tolerances, independent of how often LMU refreshes timeIntoLap — tune if the clock drifts
/** A lap-start estimate this much later than the anchor means a pause/rewind happened → re-anchor */
const REANCHOR_MS = 1000;
/** No new value for this long → the clock isn't running in-game; stop advancing */
const STALE_MS = 1500;

/**
 * Running lap time as a smooth local clock. Each telemetry value is turned into an estimated
 * lap-start instant (`now - value`); samples arrive late by a varying amount, so the earliest
 * estimate is the least delayed one and becomes the anchor. The display then just counts from
 * the anchor every frame — it never jumps back on a poll. A new lap (value drops) or a pause
 * (estimate drifts past REANCHOR_MS) re-anchors. Writes the DOM directly: no re-render per frame.
 */
export function LapClock({ value, className }: { value: number | null; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const clock = useRef<{ anchor: number | null; last: number | null; changedAt: number }>({ anchor: null, last: null, changedAt: 0 });

  // Runs only when the game reports a *new* value — repeats of the same value carry no timing info
  useEffect(() => {
    const c = clock.current;
    const now = performance.now();
    if (value === null) { c.anchor = null; c.last = null; return; }
    const estimate = now - value * 1000;
    const newLap = c.last === null || value < c.last;
    c.anchor = newLap || c.anchor === null || estimate > c.anchor + REANCHOR_MS ? estimate : Math.min(c.anchor, estimate);
    c.last = value;
    c.changedAt = now;
  }, [value]);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      const { anchor, changedAt } = clock.current;
      const now = performance.now();
      // When stale, hold the time reached at the stale moment instead of snapping back
      const t = anchor === null ? null : (Math.min(now, changedAt + STALE_MS) - anchor) / 1000;
      if (ref.current) ref.current.textContent = formatLapTime(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // No React-managed text: a re-render on each poll would overwrite the interpolated time for a frame
  return <span ref={ref} className={className} />;
}
