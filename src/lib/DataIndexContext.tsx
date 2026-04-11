import { useMemo } from 'react';
import type { RaceFile } from './types';
import {
  getPersonalBests,
  getAllSessionBests,
  getAllLaps,
  getTrackStats,
  getCarStats,
  getDriverSessions,
} from './analytics';
import { DataIndexContext, type DataIndex } from './dataIndexContext';

export function DataIndexProvider({
  files,
  driverNames,
  children,
}: {
  files: RaceFile[];
  driverNames: string[];
  children: React.ReactNode;
}) {
  const index = useMemo<DataIndex>(() => ({
    personalBests: getPersonalBests(files, driverNames),
    allSessionBests: getAllSessionBests(files, driverNames),
    allLaps: getAllLaps(files, driverNames),
    trackStats: getTrackStats(files, driverNames),
    carStats: getCarStats(files, driverNames),
    driverSessions: getDriverSessions(files, driverNames),
  }), [files, driverNames]);

  return (
    <DataIndexContext.Provider value={index}>
      {children}
    </DataIndexContext.Provider>
  );
}
