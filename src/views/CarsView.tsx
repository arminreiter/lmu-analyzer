import { useState, useMemo, memo } from 'react';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SessionLink } from '../components/SessionLink';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, formatSector, formatSpeed, formatDistance, getCarStats, getPersonalBests, getAllSessionBests, getAllLaps } from '../lib/analytics';
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

export const CarsView = memo(function CarsView({ files, driverNames, initialCar, onNavigate }: CarsViewProps) {
  const [selectedCar, setSelectedCar] = useState<string | null>(initialCar ?? null);
  const [lapMode, setLapMode] = useState<LapMode>('track');
  const cars = useMemo(() => getCarStats(files, driverNames), [files, driverNames]);
  const bestPerTrack = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);
  const bestPerSession = useMemo(() => getAllSessionBests(files, driverNames), [files, driverNames]);
  const allLaps = useMemo(() => getAllLaps(files, driverNames), [files, driverNames]);

  const car = selectedCar ?? cars[0]?.carType;
  const carInfo = cars.find(c => c.carType === car);

  const lapSource = lapMode === 'all' ? allLaps : lapMode === 'session' ? bestPerSession : bestPerTrack;
  const carLaps = useMemo(() => lapSource.filter(b => b.carType === car), [lapSource, car]);

  const lapColumns: Column<PersonalBest>[] = useMemo(() => [
    { key: 'track', label: 'Track', width: '22%', sortValue: r => r.trackCourse,
      render: r => onNavigate
        ? <button onClick={(e) => { e.stopPropagation(); onNavigate('tracks', r.trackCourse); }} className="text-white cursor-pointer">{r.trackCourse}</button>
        : <span className="text-white">{r.trackCourse}</span> },
    { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '95px', sortValue: r => r.lapTime,
      render: r => <span className="text-white font-bold">{formatLapTime(r.lapTime)}</span> },
    { key: 's1', label: 'S1', align: 'right', mono: true, width: '70px', sortValue: r => r.sector1,
      render: r => <span className="text-racing-muted">{formatSector(r.sector1)}</span> },
    { key: 's2', label: 'S2', align: 'right', mono: true, width: '70px', sortValue: r => r.sector2,
      render: r => <span className="text-racing-muted">{formatSector(r.sector2)}</span> },
    { key: 's3', label: 'S3', align: 'right', mono: true, width: '70px', sortValue: r => r.sector3,
      render: r => <span className="text-racing-muted">{formatSector(r.sector3)}</span> },
    { key: 'speed', label: 'Speed', align: 'right', mono: true, width: '75px', sortValue: r => r.topSpeed,
      render: r => <span className="text-white/70">{formatSpeed(r.topSpeed)}</span> },
    { key: 'session', label: 'Session', width: '85px', sortValue: r => r.sessionType,
      render: r => onNavigate
        ? <SessionLink fileName={r.fileName} sessionIndex={r.sessionIndex} onNavigate={onNavigate}>{r.sessionType} L{r.lapNumber}</SessionLink>
        : <span className="text-racing-muted text-xs">{r.sessionType} L{r.lapNumber}</span> },
    { key: 'date', label: 'Date', width: '105px', sortValue: r => r.date,
      render: r => <span className="text-racing-muted/60 text-xs">{r.date}</span> },
  ], [onNavigate]);

  const sortedCarLaps = useMemo(() =>
    [...carLaps].sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime),
    [carLaps]
  );

  return (
    <div className="space-y-6">
      {/* Car Selector */}
      <div className="flex gap-2 flex-wrap">
        {cars.map(c => (
          <button
            key={c.carType}
            onClick={() => setSelectedCar(c.carType)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer
              ${c.carType === car
                ? 'bg-racing-red text-[#fff]'
                : 'bg-racing-card border border-racing-border text-racing-muted hover:text-white hover:border-racing-highlight'}`}
          >
            {c.carType}
            <ClassBadge carClass={c.carClass} />
          </button>
        ))}
      </div>

      {car && carInfo && (
        <>
          {/* Car Stats */}
          <div className="data-card carbon-fiber p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-racing text-xl font-bold text-white tracking-wider">{car}</h2>
              <ClassBadge carClass={carInfo.carClass} />
            </div>
            {(() => {
              const validLaps = allLaps.filter(l => l.carType === car).length;
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
                    <p className="text-white text-lg font-bold">{carInfo.tracks.length}</p>
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
              <ExportButton columns={lapColumns} data={sortedCarLaps} filename={`lmu-car-${(car ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`} />
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
