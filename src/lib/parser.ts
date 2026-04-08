import type {
  RaceFile, SessionData, SessionType, DriverResult, LapData,
  CarClass, IncidentData, PenaltyData, TrackLimitData,
} from './types';

function getText(el: Element, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

function getNum(el: Element, tag: string): number {
  const val = parseFloat(getText(el, tag));
  return isNaN(val) ? 0 : val;
}

function getAttr(el: Element, attr: string): string {
  return el.getAttribute(attr) ?? '';
}

function getAttrNum(el: Element, attr: string): number {
  const val = parseFloat(getAttr(el, attr));
  return isNaN(val) ? 0 : val;
}

function resolveCarClass(raw: string): CarClass {
  const lower = raw.toLowerCase();
  if (lower === 'hyper' || lower === 'hypercar') return 'Hyper';
  if (lower === 'gt3' || lower === 'lmgt3') return 'GT3';
  if (lower === 'gte' || lower === 'lmgte') return 'GTE';
  if (lower === 'lmp3') return 'LMP3';
  return 'Unknown';
}

function parseLapTime(raw: string): number | null {
  if (!raw || raw.includes('--')) return null;
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

function parseSectorTime(raw: string | null): number | null {
  if (!raw) return null;
  const val = parseFloat(raw);
  return isNaN(val) || val < 0 ? null : val;
}

function parseLap(lapEl: Element): LapData {
  const lapTimeRaw = lapEl.textContent?.trim() ?? '';
  return {
    num: parseInt(getAttr(lapEl, 'num')) || 0,
    position: parseInt(getAttr(lapEl, 'p')) || 0,
    elapsedTime: getAttrNum(lapEl, 'et'),
    sector1: parseSectorTime(getAttr(lapEl, 's1') || null),
    sector2: parseSectorTime(getAttr(lapEl, 's2') || null),
    sector3: parseSectorTime(getAttr(lapEl, 's3') || null),
    lapTime: parseLapTime(lapTimeRaw),
    topSpeed: getAttrNum(lapEl, 'topspeed'),
    fuel: getAttrNum(lapEl, 'fuel'),
    fuelUsed: getAttrNum(lapEl, 'fuelUsed'),
    vehicleEnergy: getAttrNum(lapEl, 've'),
    vehicleEnergyUsed: getAttrNum(lapEl, 'veUsed'),
    tireWear: {
      fl: getAttrNum(lapEl, 'twfl'),
      fr: getAttrNum(lapEl, 'twfr'),
      rl: getAttrNum(lapEl, 'twrl'),
      rr: getAttrNum(lapEl, 'twrr'),
    },
    frontCompound: getAttr(lapEl, 'fcompound').replace(/^\d+,/, ''),
    rearCompound: getAttr(lapEl, 'rcompound').replace(/^\d+,/, ''),
    isPit: getAttr(lapEl, 'pit') === '1',
  };
}

function parseDriver(driverEl: Element): DriverResult {
  const laps: LapData[] = [];
  const lapEls = driverEl.getElementsByTagName('Lap');
  for (let i = 0; i < lapEls.length; i++) {
    laps.push(parseLap(lapEls[i]));
  }

  const bestLapRaw = getText(driverEl, 'BestLapTime');
  const finishTimeRaw = getText(driverEl, 'FinishTime');

  return {
    name: getText(driverEl, 'Name'),
    vehicleFile: getText(driverEl, 'VehFile'),
    vehicleName: getText(driverEl, 'VehName'),
    category: getText(driverEl, 'Category'),
    carType: getText(driverEl, 'CarType'),
    carClass: resolveCarClass(getText(driverEl, 'CarClass')),
    carNumber: getText(driverEl, 'CarNumber'),
    teamName: getText(driverEl, 'TeamName'),
    isPlayer: getText(driverEl, 'isPlayer') === '1',
    gridPosition: parseInt(getText(driverEl, 'GridPos')) || null,
    position: parseInt(getText(driverEl, 'Position')) || 0,
    classGridPosition: parseInt(getText(driverEl, 'ClassGridPos')) || null,
    classPosition: parseInt(getText(driverEl, 'ClassPosition')) || 0,
    bestLapTime: parseLapTime(bestLapRaw),
    finishTime: finishTimeRaw ? parseFloat(finishTimeRaw) || null : null,
    totalLaps: parseInt(getText(driverEl, 'Laps')) || laps.length,
    pitstops: parseInt(getText(driverEl, 'Pitstops')) || 0,
    finishStatus: getText(driverEl, 'FinishStatus'),
    controlAndAids: getText(driverEl, 'ControlAndAids'),
    laps,
  };
}

const SESSION_TAG_MAP: Record<string, SessionType> = {
  Practice1: 'Practice', Practice2: 'Practice', Practice3: 'Practice', Practice4: 'Practice',
  Qualify: 'Qualifying', Qualify1: 'Qualifying', Qualify2: 'Qualifying',
  Warmup: 'Warmup',
  Race: 'Race', Race1: 'Race', Race2: 'Race',
};

const SESSION_TAGS = Object.keys(SESSION_TAG_MAP);

function parseStreamEvents(streamEl: Element | null) {
  const incidents: IncidentData[] = [];
  const penalties: PenaltyData[] = [];
  const trackLimits: TrackLimitData[] = [];

  if (!streamEl) return { incidents, penalties, trackLimits };

  for (let i = 0; i < streamEl.children.length; i++) {
    const child = streamEl.children[i];
    const tag = child.tagName;
    const et = getAttrNum(child, 'et');
    const text = child.textContent?.trim() ?? '';

    if (tag === 'Incident') {
      const severityMatch = text.match(/\((\d+\.?\d*)\)/);
      incidents.push({
        time: et,
        description: text,
        driver1: getAttr(child, 'Driver') || text.split('(')[0].trim(),
        driver2: text.includes('with another vehicle') ? text.split('with another vehicle ')[1]?.split('(')[0]?.trim() ?? null : null,
        severity: severityMatch ? parseFloat(severityMatch[1]) : 0,
      });
    } else if (tag === 'Penalty') {
      penalties.push({
        time: et,
        driver: getAttr(child, 'Driver'),
        type: getAttr(child, 'Penalty'),
        reason: getAttr(child, 'Reason'),
        description: text,
      });
    } else if (tag === 'TrackLimits') {
      const resolution = text;
      trackLimits.push({
        time: et,
        driver: getAttr(child, 'Driver'),
        lap: parseInt(getAttr(child, 'Lap')) || 0,
        warningPoints: parseFloat(getAttr(child, 'WarningPoints')) || 0,
        currentPoints: parseFloat(getAttr(child, 'CurrentPoints')) || 0,
        resolution,
      });
    }
  }
  return { incidents, penalties, trackLimits };
}

function parseSession(sessionEl: Element, type: SessionType, index: number): SessionData {
  const streamEl = sessionEl.getElementsByTagName('Stream')[0] ?? null;
  const { incidents, penalties, trackLimits } = parseStreamEvents(streamEl);

  const drivers: DriverResult[] = [];
  const driverEls = sessionEl.getElementsByTagName('Driver');
  for (let i = 0; i < driverEls.length; i++) {
    drivers.push(parseDriver(driverEls[i]));
  }

  return {
    type,
    sessionIndex: index,
    dateTime: getText(sessionEl, 'TimeString'),
    lapsLimit: parseInt(getText(sessionEl, 'Laps')) || 0,
    minutesLimit: parseInt(getText(sessionEl, 'Minutes')) || 0,
    mostLapsCompleted: parseInt(getText(sessionEl, 'MostLapsCompleted')) || 0,
    drivers,
    incidents,
    penalties,
    trackLimits,
  };
}

export function parseRaceFile(xmlString: string, fileName: string): RaceFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const root = doc.getElementsByTagName('RaceResults')[0];

  if (!root) throw new Error(`Invalid race file: ${fileName}`);

  const sessions: SessionData[] = [];
  let sessionIdx = 0;
  for (const tag of SESSION_TAGS) {
    const els = root.getElementsByTagName(tag);
    for (let i = 0; i < els.length; i++) {
      sessions.push(parseSession(els[i], SESSION_TAG_MAP[tag], sessionIdx++));
    }
  }

  const vehiclesAllowed = getText(root, 'VehiclesAllowed')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  return {
    fileName,
    setting: getText(root, 'Setting'),
    serverName: getText(root, 'ServerName'),
    dateTime: getText(root, 'DateTime'),
    timeString: getText(root, 'TimeString'),
    trackVenue: getText(root, 'TrackVenue'),
    trackCourse: getText(root, 'TrackCourse'),
    trackEvent: getText(root, 'TrackEvent'),
    trackLength: getNum(root, 'TrackLength'),
    gameVersion: getText(root, 'GameVersion'),
    raceLaps: getNum(root, 'RaceLaps'),
    raceTime: getNum(root, 'RaceTime'),
    mechFailRate: getNum(root, 'MechFailRate'),
    damageMult: getNum(root, 'DamageMult'),
    fuelMult: getNum(root, 'FuelMult'),
    tireMult: getNum(root, 'TireMult'),
    vehiclesAllowed,
    sessions,
  };
}

export async function loadFolder(dirHandle: FileSystemDirectoryHandle): Promise<RaceFile[]> {
  const files: RaceFile[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.xml')) {
      try {
        const file = await entry.getFile();
        const text = await file.text();
        files.push(parseRaceFile(text, entry.name));
      } catch (e) {
        console.warn(`Failed to parse ${entry.name}:`, e);
      }
    }
  }

  files.sort((a, b) => a.timeString.localeCompare(b.timeString));
  return files;
}

export async function loadFiles(fileList: File[]): Promise<RaceFile[]> {
  const files: RaceFile[] = [];

  for (const file of fileList) {
    if (!file.name.endsWith('.xml')) continue;
    try {
      const text = await file.text();
      files.push(parseRaceFile(text, file.name));
    } catch (e) {
      console.warn(`Failed to parse ${file.name}:`, e);
    }
  }

  files.sort((a, b) => a.timeString.localeCompare(b.timeString));
  return files;
}
