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

export function getChartTooltipStyle() {
  const isLight = document.documentElement.classList.contains('light');
  return {
    background: isLight ? '#ffffff' : '#1a1a24',
    border: isLight ? '1px solid #d1d5db' : '1px solid #2a2a3a',
    borderRadius: 8,
    fontSize: 12,
    color: isLight ? '#1f2937' : '#e5e7eb',
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
