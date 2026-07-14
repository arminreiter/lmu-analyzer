import type { CarClass } from './types';

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsStr = secs.toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${secsStr}` : secsStr;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

export function formatEventTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export function formatSector(v: number | null): string {
  if (v === null) return '--';
  return v.toFixed(3);
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(0)} km/h`;
}

export function formatDistance(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

// Shared Recharts theme values — centralized so all views use the same chart chrome
export const CHART_AXIS_TICK = '#6b7280';
export const CHART_GRID_STROKE = '#2a2a3a';

/** Human-readable message from an unknown thrown value */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function getChartTooltipStyle() {
  return {
    background: 'var(--color-racing-card)',
    border: '1px solid var(--color-racing-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-racing-text)',
  };
}

export function getConsistencyColor(c: number): string {
  return c > 98 ? 'text-racing-green' : c > 95 ? 'text-racing-yellow' : 'text-racing-orange';
}

export function getSessionTypeStyle(type: string): string {
  return type === 'Race' ? 'bg-racing-red/20 text-racing-red'
    : type === 'Qualifying' ? 'bg-racing-yellow/20 text-racing-yellow'
    : 'bg-racing-blue/20 text-racing-blue';
}

export function getClassColor(carClass: CarClass): string {
  switch (carClass) {
    case 'Hyper': return 'var(--color-hyper)';
    case 'GT3': return 'var(--color-gt3)';
    case 'GTE': return 'var(--color-gte)';
    case 'LMP3': return 'var(--color-lmp3)';
    case 'LMP2-WEC': return 'var(--color-lmp2wec)';
    case 'LMP2-ELMS': return 'var(--color-lmp2elms)';
    default: return 'var(--color-racing-muted)';
  }
}
