/**
 * Race pace benchmarks from ohne_speed's community spreadsheet.
 * Source: https://www.youtube.com/@ohne_speed
 * Discord: https://discord.com/invite/dFAqhnuSXH
 *
 * This module is self-contained — remove it (and RacePaceView) to fully
 * remove the feature.
 */

import type { CarClass } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaceBenchmark {
  track: string;           // spreadsheet track name, e.g. "Monza"
  carClass: CarClass;      // mapped to app's CarClass
  hotlapTime: number;      // seconds
  racePace: {
    alien: number;         // ~100%
    competitive: number;   // 101%
    good: number;          // 102%
    midpack: number;       // 104%
    tailEnder: number;     // 106%
    offline: number;       // 107%
  };
  fastestCar: string;
  fastestLapTime: number;
}

export type PaceRating = 'Alien' | 'Competitive' | 'Good' | 'Midpack' | 'Tail-ender' | 'Offline';

// ---------------------------------------------------------------------------
// Spreadsheet class → app CarClass mapping
// ---------------------------------------------------------------------------

const CLASS_MAP: Record<string, CarClass> = {
  LMGT3: 'GT3',
  LMH: 'Hyper',
  GTE: 'GTE',
  LMP3: 'LMP3',
  LMP2elms: 'LMP2-ELMS',
  LMP2wec: 'LMP2-WEC',
};

// ---------------------------------------------------------------------------
// LMU trackCourse → spreadsheet track name mapping
// Uses trackCourse (layout-specific) first, falls back to trackVenue.
// ---------------------------------------------------------------------------

/** Map by trackCourse (most specific — differentiates layouts) */
const COURSE_MAP: Record<string, string> = {
  // Monza layouts
  'Autodromo Nazionale Monza': 'Monza',
  'Monza Curva Grande Variant': 'Monza (curvagrande)',
  'Monza Curva Grande Circuit': 'Monza (curvagrande)',
  // Spa
  'Circuit de Spa-Francorchamps': 'Spa',
  // Le Mans layouts
  'Circuit de la Sarthe': 'Circuit de la Sarthe',
  'Circuit de la Sarthe without chicanes': 'Circuit de la Sarthe (straight)',
  'Circuit de la Sarthe Mulsanne': 'Circuit de la Sarthe (straight)',
  // Barcelona
  'Circuit de Barcelona': 'Barcelona',
  // Imola
  'Autodromo Enzo e Dino Ferrari': 'Imola',
  // Bahrain layouts
  'Bahrain International Circuit': 'Bahrain (wec)',
  'Bahrain Endurance Circuit': 'Bahrain (endurance)',
  'Bahrain Outer Circuit': 'Bahrain (outer)',
  'Bahrain Paddock Circuit': 'Bahrain (paddock)',
  // COTA layouts
  'Circuit of the Americas': 'COTA',
  'COTA National Circuit': 'COTA (national)',
  // Portimao
  'Algarve International Circuit': 'Portimao',
  // Fuji layouts
  'Fuji Speedway': 'Fuji (chicane)',
  'Fuji Speedway Classic': 'Fuji (classic)',
  // Sebring layouts
  'Sebring International Raceway': 'Sebring',
  'Sebring School Circuit': 'Sebring (school)',
  // Silverstone layouts
  'Silverstone Grand Prix Circuit': 'Silverstone (GP)',
  'Silverstone Grand Prix Circuit - ELMS': 'Silverstone (GP)',
  'Silverstone National Circuit': 'Silverstone (National)',
  'Silverstone International Circuit': 'Silverstone (International)',
  // Qatar layouts
  'Lusail International Circuit': 'Qatar',
  'Lusail Short Circuit': 'Qatar (short)',
  // Interlagos
  'Autódromo José Carlos Pace': 'Interlagos',
  'Autodromo Jose Carlos Pace': 'Interlagos',
  // Paul Ricard layouts
  'Circuit Paul Ricard': 'Paul Ricard',
  'Paul Ricard - 1A': 'Paul Ricard (1A)',
  'Paul Ricard - 1A-V2': 'Paul Ricard (1A v2)',
  'Paul Ricard - 1A-V2-Short': 'Paul Ricard (1A v2 short)',
  'Paul Ricard - 3A': 'Paul Ricard (3A)',
};

/** Fallback map by trackVenue (when trackCourse matches venue name) */
const VENUE_FALLBACK: Record<string, string> = {
  'Autodromo Nazionale Monza': 'Monza',
  'Circuit de Spa-Francorchamps': 'Spa',
  'Circuit de la Sarthe': 'Circuit de la Sarthe',
  'Circuit de Barcelona': 'Barcelona',
  'Autodromo Enzo e Dino Ferrari': 'Imola',
  'Bahrain International Circuit': 'Bahrain (wec)',
  'Circuit of the Americas': 'COTA',
  'Algarve International Circuit': 'Portimao',
  'Fuji Speedway': 'Fuji (chicane)',
  'Sebring International Raceway': 'Sebring',
  'Silverstone Circuit': 'Silverstone (GP)',
  'Lusail International Circuit': 'Qatar',
  'Autódromo José Carlos Pace': 'Interlagos',
  'Circuit Paul Ricard': 'Paul Ricard',
};

export function mapTrackName(trackCourse: string, trackVenue?: string): string | null {
  return COURSE_MAP[trackCourse] ?? (trackVenue ? VENUE_FALLBACK[trackVenue] : null) ?? null;
}

// ---------------------------------------------------------------------------
// CSV URL (published Google Sheet)
// ---------------------------------------------------------------------------

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTN03UvJDm99byA6vQPZHKOCYVvfxLu1zkJAzdaKyROykzEKY2-Xl1rl1q5znZEf36m88dxMKsY2eaO/pub?gid=1766901750&single=true&output=csv';

// ---------------------------------------------------------------------------
// Parse lap time string "M:SS.sss" → seconds
// ---------------------------------------------------------------------------

function parseLapTimeStr(s: string): number | null {
  s = s.trim();
  if (!s || s === '--:--.---' || s === '0:00.00') return null;
  const parts = s.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const val = parseFloat(s);
  return isNaN(val) ? null : val;
}

// ---------------------------------------------------------------------------
// Fetch & parse
// ---------------------------------------------------------------------------

let cachedBenchmarks: PaceBenchmark[] | null = null;

export async function fetchBenchmarks(): Promise<PaceBenchmark[]> {
  if (cachedBenchmarks) return cachedBenchmarks;

  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error(`Failed to fetch pace data: ${res.status}`);
  const text = await res.text();
  cachedBenchmarks = parseCSV(text);
  return cachedBenchmarks;
}

export function clearBenchmarkCache() {
  cachedBenchmarks = null;
}

function parseCSV(csv: string): PaceBenchmark[] {
  const lines = csv.split('\n');
  const benchmarks: PaceBenchmark[] = [];
  let currentSheetClass: string | null = null;

  for (const line of lines) {
    // Detect class header rows like "L M G T 3" or "L M H"
    if (line.includes('L M G T 3')) { currentSheetClass = 'LMGT3'; continue; }
    if (line.includes('L M H') && !line.includes('L M G')) { currentSheetClass = 'LMH'; continue; }
    if (line.includes('L M P 3')) { currentSheetClass = 'LMP3'; continue; }
    if (line.includes('L M P 2   E L M S')) { currentSheetClass = 'LMP2elms'; continue; }
    if (line.includes('L M P 2   W E C')) { currentSheetClass = 'LMP2wec'; continue; }
    if (line.includes('G T E') && !line.includes('LMGT')) { currentSheetClass = 'GTE'; continue; }

    if (!currentSheetClass) continue;
    const appClass = CLASS_MAP[currentSheetClass];
    if (!appClass) continue;

    // Data rows start with a combined key like "Bahrain (wec)LMGT3"
    // Column layout: key, track, patch, hotlap, alien, competitive, good, 103%, midpack, 105%, tailender, 107%, fastestCar, laptime, ...
    const cols = parseCSVLine(line);
    if (cols.length < 12) continue;

    const track = cols[1]?.trim();
    if (!track || track === 'Track') continue;

    // Verify this is a data row: col[0] should contain the class suffix
    if (!cols[0]?.includes(currentSheetClass)) continue;

    const hotlap = parseLapTimeStr(cols[3]);
    const alien = parseLapTimeStr(cols[4]);
    const competitive = parseLapTimeStr(cols[5]);
    const good = parseLapTimeStr(cols[6]);
    // cols[7] = 103%, cols[8] = midpack (104%)
    const midpack = parseLapTimeStr(cols[8]);
    // cols[9] = 105%, cols[10] = tail-ender (106%)
    const tailEnder = parseLapTimeStr(cols[10]);
    // cols[11] = offline (107%)
    const offline = parseLapTimeStr(cols[11]);
    const fastestCar = cols[12]?.trim() ?? '';
    const fastestLapTime = parseLapTimeStr(cols[13]);

    if (!hotlap || !alien || !competitive || !good || !midpack || !tailEnder || !offline) continue;

    benchmarks.push({
      track,
      carClass: appClass,
      hotlapTime: hotlap,
      racePace: { alien, competitive, good, midpack, tailEnder, offline },
      fastestCar,
      fastestLapTime: fastestLapTime ?? 0,
    });
  }

  return benchmarks;
}

/** Simple CSV line parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Rating logic
// ---------------------------------------------------------------------------

export function rateLapTime(lapTime: number, benchmark: PaceBenchmark): { rating: PaceRating; delta: number; percent: number } {
  const { racePace } = benchmark;
  const percent = (lapTime / racePace.alien) * 100;

  let rating: PaceRating;
  if (lapTime <= racePace.alien) rating = 'Alien';
  else if (lapTime <= racePace.competitive) rating = 'Competitive';
  else if (lapTime <= racePace.good) rating = 'Good';
  else if (lapTime <= racePace.midpack) rating = 'Midpack';
  else if (lapTime <= racePace.tailEnder) rating = 'Tail-ender';
  else rating = 'Offline';

  return { rating, delta: lapTime - racePace.alien, percent };
}

/** Returns the next tier to aim for: its name, target time, and gap from the user's lap. */
export function getNextTarget(lapTime: number, rating: PaceRating, benchmark: PaceBenchmark): { label: PaceRating; time: number; gap: number } | null {
  const { racePace } = benchmark;
  // Map each rating to the tier boundary the user needs to beat to reach it
  switch (rating) {
    case 'Alien': return null; // already at the top
    case 'Competitive': return { label: 'Alien', time: racePace.alien, gap: lapTime - racePace.alien };
    case 'Good': return { label: 'Competitive', time: racePace.competitive, gap: lapTime - racePace.competitive };
    case 'Midpack': return { label: 'Good', time: racePace.good, gap: lapTime - racePace.good };
    case 'Tail-ender': return { label: 'Midpack', time: racePace.midpack, gap: lapTime - racePace.midpack };
    case 'Offline': return { label: 'Tail-ender', time: racePace.tailEnder, gap: lapTime - racePace.tailEnder };
  }
}

export function getRatingColor(rating: PaceRating): string {
  switch (rating) {
    case 'Alien': return 'text-racing-purple';
    case 'Competitive': return 'text-racing-green';
    case 'Good': return 'text-racing-green/80';
    case 'Midpack': return 'text-racing-yellow';
    case 'Tail-ender': return 'text-racing-orange';
    case 'Offline': return 'text-racing-red';
  }
}

export function getRatingBgColor(rating: PaceRating): string {
  switch (rating) {
    case 'Alien': return 'bg-racing-purple/15 border-racing-purple/30';
    case 'Competitive': return 'bg-racing-green/15 border-racing-green/30';
    case 'Good': return 'bg-racing-green/10 border-racing-green/20';
    case 'Midpack': return 'bg-white/5 border-white/10';
    case 'Tail-ender': return 'bg-racing-yellow/10 border-racing-yellow/20';
    case 'Offline': return 'bg-racing-orange/10 border-racing-orange/20';
  }
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findBenchmark(benchmarks: PaceBenchmark[], trackName: string, carClass: CarClass): PaceBenchmark | null {
  const mappedTrack = trackName; // already mapped by caller
  return benchmarks.find(b => b.track === mappedTrack && b.carClass === carClass) ?? null;
}

export function getAvailableTracks(benchmarks: PaceBenchmark[]): string[] {
  return [...new Set(benchmarks.map(b => b.track))];
}
