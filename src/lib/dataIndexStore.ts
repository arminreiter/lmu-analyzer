import { createContext } from 'react';
import type { RaceFile, PersonalBest, SessionData, DriverResult } from './types';
import type { TrackStats, CarStats, SectorMins } from './analytics';

export interface DataIndex {
  personalBests: PersonalBest[];
  allSessionBests: PersonalBest[];
  allLaps: PersonalBest[];
  trackStats: TrackStats[];
  carStats: CarStats[];
  driverSessions: Array<{ file: RaceFile; session: SessionData; driver: DriverResult }>;
  /** Best sector times keyed by `${trackCourse}|${carType}` — feed into getTheoreticalBest */
  sectorMins: Map<string, SectorMins>;
}

export const DataIndexContext = createContext<DataIndex | null>(null);
