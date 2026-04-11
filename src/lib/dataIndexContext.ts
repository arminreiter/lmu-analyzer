import { createContext } from 'react';
import type { RaceFile, PersonalBest, SessionData, DriverResult } from './types';
import type { TrackStats, CarStats } from './analytics';

export interface DataIndex {
  personalBests: PersonalBest[];
  allSessionBests: PersonalBest[];
  allLaps: PersonalBest[];
  trackStats: TrackStats[];
  carStats: CarStats[];
  driverSessions: Array<{ file: RaceFile; session: SessionData; driver: DriverResult }>;
}

export const DataIndexContext = createContext<DataIndex | null>(null);
