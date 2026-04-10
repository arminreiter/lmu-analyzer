export type SessionType = 'Practice' | 'Qualifying' | 'Race' | 'Warmup';
export type CarClass = 'Hyper' | 'GT3' | 'GTE' | 'LMP3' | 'Unknown';

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
  laps: LapData[];
}

export interface SessionData {
  type: SessionType;
  sessionIndex: number;
  dateTime: string;
  lapsLimit: number;
  minutesLimit: number;
  mostLapsCompleted: number;
  drivers: DriverResult[];
  incidents: IncidentData[];
  penalties: PenaltyData[];
  trackLimits: TrackLimitData[];
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

