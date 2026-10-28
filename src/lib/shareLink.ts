import { isTauri } from '@tauri-apps/api/core';
import { compress, decompress, TooLargeError } from './download';
import { isDriverIncident } from './analytics';
import type { DriverResult, LapData, RaceFile, SessionData } from './types';

// The desktop app's origin (tauri://…) means nothing to whoever receives the link
const PUBLIC_URL = 'https://lmu.a31.at/';

// Links are crafted by anyone: cap the work a payload can cause, including render cost (a highly
// compressible link can expand to millions of laps). A 24h race is ~400 laps a car; a 6h race with
// 60 cars ~150 KB encoded. All far below these.
const MAX_ENCODED = 2_000_000;
const MAX_JSON_BYTES = 32_000_000;
const MAX_DRIVERS = 200;
const MAX_LAPS = 1_000;
const MAX_TOTAL_LAPS = 50_000;
const MAX_EVENTS = 20_000;

/** Other drivers' laps, cut to what the standings and gap chart need: [num, position, et, lapTime, isPit] */
type LapTuple = [number, number, number, number | null, 0 | 1];

interface Payload {
  v: 1;
  driver: string;
  file: RaceFile;
  /** Laps of the other drivers in the shared driver's class, by name */
  rivals: Record<string, LapTuple[]>;
}

export interface SharedSession {
  file: RaceFile;
  session: SessionData;
  driver: DriverResult;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export class ShareTooLargeError extends Error {
  constructor() {
    super('This session is too large to share as a link');
  }
}

/** Both sides apply the same caps, so the sender is told instead of sending a link that won't open */
function checkCaps(payload: Payload) {
  const session = payload.file.sessions[0];
  const lapCounts = [...session.drivers.map(d => d?.laps?.length ?? 0), ...Object.values(payload.rivals ?? {}).map(l => l?.length ?? 0)];
  const eventCounts = [session.incidents, session.penalties, session.trackLimits, session.sectorBests, session.driverChanges]
    .map(list => list?.length ?? 0);
  if (session.drivers.length > MAX_DRIVERS
    || lapCounts.some(n => n > MAX_LAPS)
    || lapCounts.reduce((a, b) => a + b, 0) > MAX_TOTAL_LAPS
    || eventCounts.some(n => n > MAX_EVENTS)) {
    throw new ShareTooLargeError();
  }
}

/**
 * One session as a URL: the shared driver's full laps and own incidents/penalties/track limits
 * (all the view shows), rivals in their class as lap tuples, everyone else as standings rows only.
 * Chat is left out — it's other people's words.
 */
export async function buildShareLink(file: RaceFile, session: SessionData, driver: DriverResult): Promise<string> {
  const rivals: Payload['rivals'] = {};
  const drivers = session.drivers.map(d => {
    if (d.name === driver.name) return d;
    if (d.carClass === driver.carClass) {
      rivals[d.name] = d.laps.map(l => [l.num, l.position, +l.elapsedTime.toFixed(3), l.lapTime, l.isPit ? 1 : 0]);
    }
    return { ...d, laps: [] };
  });
  const payload: Payload = {
    v: 1,
    driver: driver.name,
    file: { ...file, sessions: [{
      ...session,
      drivers,
      chat: [],
      incidents: session.incidents.filter(i => isDriverIncident(i, driver.name)),
      penalties: session.penalties.filter(p => p.driver === driver.name),
      trackLimits: session.trackLimits.filter(t => t.driver === driver.name),
    }] },
    rivals,
  };
  checkCaps(payload);
  const encoded = toBase64Url(await compress(JSON.stringify(payload), 'deflate-raw'));
  const base = isTauri() ? PUBLIC_URL : `${location.origin}${location.pathname}`;
  return `${base}#shared/${encoded}`;
}

function rivalLap([num, position, elapsedTime, lapTime, isPit]: LapTuple): LapData {
  return {
    num, position, elapsedTime, lapTime, isPit: isPit === 1,
    sector1: null, sector2: null, sector3: null, topSpeed: 0, fuel: 0, fuelUsed: 0, vehicleEnergy: 0, vehicleEnergyUsed: 0,
    tireWear: { fl: 0, fr: 0, rl: 0, rr: 0 }, frontCompound: '', rearCompound: '',
  };
}

/** Decode a #shared/… payload; throws on anything malformed (the view also sits in an error boundary) */
export async function parseShareLink(encoded: string): Promise<SharedSession> {
  if (encoded.length > MAX_ENCODED) throw new ShareTooLargeError();
  const json = await decompress(fromBase64Url(encoded), 'deflate-raw', MAX_JSON_BYTES).catch(e => {
    throw e instanceof TooLargeError ? new ShareTooLargeError() : e;
  });
  const payload = JSON.parse(json) as Payload;
  const session = payload?.file?.sessions?.[0];
  if (payload?.v !== 1 || !session || !Array.isArray(session.drivers)) throw new Error('Unsupported shared session');
  checkCaps(payload);
  const rivals = payload.rivals && typeof payload.rivals === 'object' ? payload.rivals : {};
  session.drivers = session.drivers.map(d => (Array.isArray(rivals[d.name]) ? { ...d, laps: rivals[d.name].map(rivalLap) } : d));
  const driver = session.drivers.find(d => d.name === payload.driver);
  if (!driver || !Array.isArray(driver.laps)) throw new Error('Shared driver missing');
  for (const key of ['incidents', 'penalties', 'trackLimits'] as const) if (!Array.isArray(session[key])) session[key] = [];
  return { file: payload.file, session, driver };
}
