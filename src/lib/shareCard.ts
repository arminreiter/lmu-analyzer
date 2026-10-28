import { downloadBlob } from './download';
import { getTopSpeed, isDnf, isValidLap, lapTimeStats } from './analytics';
import { formatFinishStatus, formatLapTime, formatSector, formatSpeed } from './formatting';
import { trackLabel } from './racepace';
import type { DriverResult, PersonalBest, RaceFile, SessionData } from './types';

export interface ShareCardData {
  /** Small line above the title, e.g. "RACE · GT3" */
  kicker: string;
  /** Track or driver name */
  title: string;
  headlineLabel: string;
  /** The big number: a lap time, "P1", ... */
  headline: string;
  /** Up to 4 smaller stats under the headline */
  stats: { label: string; value: string }[];
  /** Bottom line: driver · car · date */
  footer: string;
  /** Slug for the downloaded file name */
  fileName: string;
}

// Always the dark racing look, whatever the app theme — the image is for Discord/socials
const W = 1200, H = 630;
const BG = '#0b0d12', CARD = '#141821', RED = '#e10600', GOLD = '#f5c518', TEXT = '#e8eaf0', MUTED = '#7a8194';

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draw a 1200×630 result card (Open Graph size) as a PNG */
export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  // Canvas only uses web fonts that are already loaded
  await Promise.all(['700 64px Orbitron', '400 24px Geist', '700 96px "Geist Mono"'].map(f => document.fonts.load(f).catch(() => null)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // Racing stripes + checkered corner
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, 0, 12, H);
  for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) {
    ctx.fillStyle = (x + y) % 2 ? '#1c212c' : '#262c39';
    ctx.fillRect(W - 6 * 22 + x * 22, 8 + y * 22, 22, 22);
  }

  const left = 72;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = RED;
  ctx.font = '700 22px Orbitron, sans-serif';
  ctx.fillText(fit(ctx, d.kicker.toUpperCase(), W - 300), left, 92);
  ctx.fillStyle = TEXT;
  ctx.font = '700 48px Orbitron, sans-serif';
  ctx.fillText(fit(ctx, d.title.toUpperCase(), W - left * 2), left, 152);

  ctx.fillStyle = MUTED;
  ctx.font = '400 24px Geist, sans-serif';
  ctx.fillText(d.headlineLabel.toUpperCase(), left, 236);
  ctx.fillStyle = GOLD;
  ctx.font = '700 112px "Geist Mono", monospace';
  ctx.fillText(fit(ctx, d.headline, W - left * 2), left, 344);

  // Stat boxes
  const stats = d.stats.slice(0, 4);
  const gap = 20, boxW = (W - left * 2 - gap * 3) / 4;
  stats.forEach((s, i) => {
    const x = left + i * (boxW + gap), y = 392;
    ctx.fillStyle = CARD;
    ctx.fillRect(x, y, boxW, 104);
    ctx.fillStyle = RED;
    ctx.fillRect(x, y, 4, 104);
    ctx.fillStyle = MUTED;
    ctx.font = '400 18px Geist, sans-serif';
    ctx.fillText(fit(ctx, s.label.toUpperCase(), boxW - 40), x + 22, y + 38);
    ctx.fillStyle = TEXT;
    ctx.font = '700 34px "Geist Mono", monospace';
    ctx.fillText(fit(ctx, s.value, boxW - 40), x + 22, y + 82);
  });

  ctx.fillStyle = MUTED;
  ctx.font = '400 22px Geist, sans-serif';
  ctx.fillText(fit(ctx, d.footer, W - left * 2 - 260), left, H - 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT;
  ctx.font = '700 20px Orbitron, sans-serif';
  ctx.fillText('LMU ANALYZER', W - left, H - 56);
  ctx.fillStyle = MUTED;
  ctx.font = '400 16px Geist, sans-serif';
  ctx.fillText('lmu.a31.at', W - left, H - 32);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png'));
}

export async function downloadShareCard(d: ShareCardData) {
  downloadBlob(await renderShareCard(d), `lmu-${d.fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`);
}

/** Copy the card to the clipboard; false when the browser can't (then the caller downloads instead) */
export async function copyShareCard(d: ShareCardData): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    // Pass the promise so Safari keeps the user gesture while the image renders
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderShareCard(d) })]);
    return true;
  } catch {
    return false;
  }
}

// ── Card builders ────────────────────────────────────────────────────────────

const date = (s: string) => s.slice(0, 10);

export function sessionCard(file: RaceFile, session: SessionData, driver: DriverResult): ShareCardData {
  const valid = driver.laps.filter(isValidLap).map(l => l.lapTime);
  const best = valid.length ? Math.min(...valid) : driver.bestLapTime;
  const footer = `${driver.name} · ${driver.carType} · ${date(session.dateTime || file.timeString)}`;
  const base = { title: trackLabel(file.trackCourse), footer, fileName: `${session.type}-${file.trackCourse}-${date(file.timeString)}` };
  if (session.type === 'Race') {
    const classSize = session.drivers.filter(d => d.carClass === driver.carClass).length;
    const gain = driver.classGridPosition ? driver.classGridPosition - driver.classPosition : null;
    return {
      ...base,
      kicker: `Race · ${driver.carClass}`,
      headlineLabel: isDnf(driver.finishStatus) ? formatFinishStatus(driver) : 'Class finish',
      headline: `P${driver.classPosition} / ${classSize}`,
      stats: [
        { label: 'Overall', value: `P${driver.position}` },
        { label: 'Class grid', value: driver.classGridPosition ? `P${driver.classGridPosition}` : '--' },
        { label: 'Places', value: gain === null ? '--' : `${gain > 0 ? '+' : ''}${gain}` },
        { label: 'Best lap', value: formatLapTime(best) },
      ],
    };
  }
  const topSpeed = getTopSpeed(driver.laps);
  const classRank = session.drivers
    .filter(d => d.carClass === driver.carClass && d.bestLapTime)
    .sort((a, b) => a.bestLapTime! - b.bestLapTime!)
    .findIndex(d => d.name === driver.name) + 1;
  return {
    ...base,
    kicker: `${session.type} · ${driver.carClass}`,
    headlineLabel: 'Best lap',
    headline: formatLapTime(best),
    stats: [
      { label: 'Class rank', value: classRank > 0 ? `P${classRank}` : '--' },
      { label: 'Laps', value: String(driver.totalLaps) },
      { label: 'Consistency', value: valid.length > 1 ? `${lapTimeStats(valid).consistency.toFixed(1)}%` : '--' },
      { label: 'Top speed', value: formatSpeed(topSpeed) },
    ],
  };
}

export function lapCard(lap: PersonalBest, truePace?: number | null): ShareCardData {
  return {
    kicker: `Personal best · ${lap.carClass}`,
    title: trackLabel(lap.trackCourse),
    headlineLabel: `${lap.sessionType} · lap ${lap.lapNumber}`,
    headline: formatLapTime(lap.lapTime),
    stats: [
      { label: 'Sector 1', value: formatSector(lap.sector1) },
      { label: 'Sector 2', value: formatSector(lap.sector2) },
      { label: 'Sector 3', value: formatSector(lap.sector3) },
      truePace ? { label: 'True pace', value: formatLapTime(truePace) } : { label: 'Top speed', value: formatSpeed(lap.topSpeed) },
    ],
    footer: `${lap.driverName} · ${lap.carType} · ${date(lap.date)}`,
    fileName: `pb-${lap.trackCourse}-${lap.carType}`,
  };
}
