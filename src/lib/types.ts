/** A results folder: browser FSA handle, or an absolute path in the Tauri desktop app */
export type ResultsFolder = FileSystemDirectoryHandle | string;

export type SessionType = 'Practice' | 'Qualifying' | 'Race' | 'Warmup';
export type CarClass = 'Hyper' | 'LMP2-WEC' | 'LMP2-ELMS' | 'GT3' | 'GTE' | 'LMP3' | 'Unknown';

export interface LapData {
  num: number;
  position: number;
  elapsedTime: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  lapTime: number | null;
  topSpeed: number;
  fuel: number;
  fuelUsed: number;
  vehicleEnergy: number;
  vehicleEnergyUsed: number;
  tireWear: { fl: number; fr: number; rl: number; rr: number };
  frontCompound: string;
  rearCompound: string;
  isPit: boolean;
}

export interface DriverResult {
  name: string;
  vehicleFile: string;
  vehicleName: string;
  category: string;
  carType: string;
  carClass: CarClass;
  carNumber: string;
  teamName: string;
  isPlayer: boolean;
  gridPosition: number | null;
  position: number;
  classGridPosition: number | null;
  classPosition: number;
  bestLapTime: number | null;
  finishTime: number | null;
  totalLaps: number;
  pitstops: number;
  finishStatus: string;
  controlAndAids: string;
  /** Why the car retired (Accident, Engine, Suspension, ...); only set for DNFs (absent in older caches) */
  dnfReason?: string;
  /** Swaps the game counted for this car; absent when the XML doesn't say (and in older caches) */
  numDriverChanges?: number;
  /** Who drove which laps of this car, from its <Swap> elements — authoritative when present */
  swaps?: { driver: string; startLap: number; endLap: number }[];
  laps: LapData[];
}

export interface SessionData {
  type: SessionType;
  sourceTag: string;
  sessionIndex: number;
  dateTime: string;
  lapsLimit: number;
  minutesLimit: number;
  mostLapsCompleted: number;
  drivers: DriverResult[];
  incidents: IncidentData[];
  penalties: PenaltyData[];
  trackLimits: TrackLimitData[];
  // Absent in sessions cached before these were parsed — read with `?? []`
  driverChanges?: DriverChangeData[];
  chat?: ChatData[];
  sectorBests?: SectorBestData[];
}

/** A driver swap in a shared car (LMU's log can miss swaps — compare with DriverResult.numDriverChanges) */
export interface DriverChangeData {
  time: number;
  /** Entry slot of the car (absent in older caches) — unlike the livery name, unique per car */
  slot?: number;
  vehicle: string;
  oldDriver: string;
  newDriver: string;
}

export interface ChatData {
  time: number;
  /** Sender as written in the chat line — may be abbreviated, so not always a DriverResult name */
  sender: string;
  message: string;
}

/** "X set new best for sector N" — a new class-best sector in this session */
export interface SectorBestData {
  time: number;
  driver: string;
  sector: 1 | 2 | 3;
  carClass: CarClass;
}

export interface IncidentData {
  time: number;
  description: string;
  driver1: string;
  driver2: string | null;
  severity: number;
}

export interface PenaltyData {
  time: number;
  driver: string;
  type: string;
  reason: string;
  description: string;
}

export interface TrackLimitData {
  time: number;
  driver: string;
  lap: number;
  warningPoints: number;
  currentPoints: number;
  resolution: string;
}

export interface RaceFile {
  fileName: string;
  setting: string;
  serverName: string;
  dateTime: string;
  timeString: string;
  trackVenue: string;
  trackCourse: string;
  trackEvent: string;
  trackLength: number;
  gameVersion: string;
  raceLaps: number;
  raceTime: number;
  mechFailRate: number;
  damageMult: number;
  fuelMult: number;
  tireMult: number;
  freeSettings: number;
  // Server rules — absent in older caches
  fixedSetups?: boolean;
  fixedUpgrades?: boolean;
  tireWarmers?: boolean;
  vehiclesAllowed: string[];
  sessions: SessionData[];
}

export interface PersonalBest {
  lapTime: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  topSpeed: number;
  trackVenue: string;
  trackCourse: string;
  carType: string;
  carClass: CarClass;
  sessionType: SessionType;
  sessionIndex: number;
  date: string;
  fileName: string;
  lapNumber: number;
  driverName: string;
}

export interface DriverSummary {
  name: string;
  sessionCount: number;
  totalLaps: number;
  isPlayer: boolean;
}
