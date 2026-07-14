import { useState, useMemo, memo } from 'react';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { PillSelector } from '../components/PillSelector';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { buildLapColumns } from '../components/lapColumns';
import { formatDistance } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
import type { RaceFile, PersonalBest } from '../lib/types';

type LapMode = 'track' | 'session' | 'all';

const MODE_LABELS: Record<LapMode, string> = {
  track: 'BEST LAP PER TRACK',
  session: 'BEST LAP PER SESSION',
  all: 'ALL LAPS',
};

interface CarsViewProps {
  files: RaceFile[];
  driverNames: string[];
  initialCar?: string | null;
  onNavigate?: (view: string, context?: string) => void;
}

export const CarsView = memo(function CarsView({ initialCar, onNavigate }: CarsViewProps) {
  const [selectedCar, setSelectedCar] = useState<string | null>(initialCar ?? null);
  const [lapMode, setLapMode] = useState<LapMode>('track');
  const { carStats: cars, personalBests: bestPerTrack, allSessionBests: bestPerSession, allLaps } = useDataIndex();

  const car = selectedCar ?? cars[0]?.carType;
  const carInfo = cars.find(c => c.carType === car);

  const lapSource = lapMode === 'all' ? allLaps : lapMode === 'session' ? bestPerSession : bestPerTrack;
  const carLaps = useMemo(() => lapSource.filter(b => b.carType === car), [lapSource, car]);

  const lapColumns: Column<PersonalBest>[] = useMemo(() => [
    { key: 'track', label: 'Track', width: '22%', sortValue: (r: PersonalBest) => r.trackCourse,
      render: (r: PersonalBest) => onNavigate
        ? <button onClick={(e) => { e.stopPropagation(); onNavigate('tracks', r.trackCourse); }} className="text-white cursor-pointer">{r.trackCourse}</button>
        : <span className="text-white">{r.trackCourse}</span> },
    ...buildLapColumns(onNavigate),
  ], [onNavigate]);

  const validLaps = useMemo(() => allLaps.filter(l => l.carType === car).length, [allLaps, car]);

  const sortedCarLaps = useMemo(() =>
    [...carLaps].sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime),
    [carLaps]
  );

  return (
    <div className="space-y-6">
      {/* Car Selector */}
      <PillSelector items={cars} itemKey={c => c.carType} selected={car} onSelect={setSelectedCar}>
        {c => <>{c.carType} <ClassBadge carClass={c.carClass} /></>}
      </PillSelector>

      {car && carInfo && (
        <>
          {/* Car Stats */}
          <div className="data-card carbon-fiber p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-racing text-xl font-bold text-white tracking-wider">{car}</h2>
              <ClassBadge carClass={carInfo.carClass} />
            </div>
            {(() => {
              const invalidLaps = carInfo.totalLaps - validLaps;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Sessions</p>
                    <p className="text-white text-lg font-bold">{carInfo.sessionCount}</p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Total Laps</p>
                    <p className="text-white text-lg font-bold">{carInfo.totalLaps}</p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Valid / Invalid</p>
                    <p className="text-lg font-bold">
                      <span className="text-racing-green">{validLaps}</span>
                      <span className="text-racing-muted mx-1">/</span>
                      <span className={invalidLaps > 0 ? 'text-racing-muted' : 'text-racing-green'}>{invalidLaps}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Distance</p>
                    <p className="text-white text-lg font-bold font-mono">{formatDistance(carInfo.totalDistanceKm)}</p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Tracks</p>
                    <p className="text-white text-lg font-bold">{carInfo.tracks.size}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Laps table */}
          <div className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={MODE_LABELS[lapMode]}>
              <span className="ml-auto mr-3 text-[10px] font-mono text-racing-muted/50">{carLaps.length} laps</span>
              <FilterButtonGroup
                options={[{ value: 'track', label: 'Per Track' }, { value: 'session', label: 'Per Session' }, { value: 'all', label: 'All Laps' }]}
                value={lapMode}
                onChange={setLapMode}
              />
              <ExportButton columns={lapColumns} data={sortedCarLaps} filename={`lmu-car-${car ?? 'unknown'}`} />
            </DataCardHeader>
            <SortableTable<PersonalBest>
              columns={lapColumns}
              data={sortedCarLaps}
              rowKey={(r, i) => `${r.trackCourse}-${r.fileName}-${r.lapNumber}-${i}`}
            />
          </div>
        </>
      )}
    </div>
  );
});
