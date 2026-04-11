import { useMemo, memo } from 'react';
import { Flag, MapPin, Car, Gauge, AlertTriangle, Ban, Route, ShieldAlert, Trophy } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, formatSector, formatDistance, getOverviewStats, getTrackStats, getCarStats, type TrackStats, type CarStats } from '../lib/analytics';
import type { RaceFile } from '../lib/types';

const trackColumns: Column<TrackStats>[] = [
  {
    key: 'track', label: 'Circuit',
    sortValue: t => t.trackCourse,
    render: t => <span className="text-racing-text">{t.trackCourse}</span>,
  },
  {
    key: 'car', label: 'Car',
    sortValue: t => t.bestCar,
    render: t => (
      <div className="flex items-center gap-1.5">
        <span className="text-racing-muted text-xs">{t.bestCar}</span>
        <ClassBadge carClass={t.bestCarClass} />
      </div>
    ),
  },
  {
    key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '7rem',
    sortValue: t => t.bestLapTime ?? Infinity,
    render: t => <span className="text-racing-green font-medium whitespace-nowrap">{formatLapTime(t.bestLapTime)}</span>,
  },
  {
    key: 's1', label: 'S1', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS1,
    render: t => <span className="text-racing-muted whitespace-nowrap">{formatSector(t.bestS1)}</span>,
  },
  {
    key: 's2', label: 'S2', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS2,
    render: t => <span className="text-racing-muted whitespace-nowrap">{formatSector(t.bestS2)}</span>,
  },
  {
    key: 's3', label: 'S3', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS3,
    render: t => <span className="text-racing-muted whitespace-nowrap">{formatSector(t.bestS3)}</span>,
  },
];

const carColumns: Column<CarStats>[] = [
  {
    key: 'car', label: 'Car',
    sortValue: c => c.carType,
    render: c => <span className="text-racing-text">{c.carType}</span>,
  },
  {
    key: 'class', label: 'Class', align: 'center', width: '75px',
    sortValue: c => c.carClass,
    render: c => <ClassBadge carClass={c.carClass} />,
  },
  {
    key: 'sessions', label: 'Sessions', align: 'right', mono: true, width: '5.5rem',
    sortValue: c => c.sessionCount,
    render: c => c.sessionCount,
  },
  {
    key: 'laps', label: 'Laps', align: 'right', mono: true, width: '5rem',
    sortValue: c => c.totalLaps,
    render: c => c.totalLaps,
  },
  {
    key: 'tracks', label: 'Tracks', align: 'right', mono: true, width: '5rem',
    sortValue: c => c.tracks.length,
    render: c => c.tracks.length,
  },
  {
    key: 'distance', label: 'Distance', align: 'right', mono: true, width: '7rem',
    sortValue: c => c.totalDistanceKm,
    render: c => <span className="text-racing-muted whitespace-nowrap">{formatDistance(c.totalDistanceKm)}</span>,
  },
];

interface OverviewViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const OverviewView = memo(function OverviewView({ files, driverNames, onNavigate }: OverviewViewProps) {
  const stats = useMemo(() => getOverviewStats(files, driverNames), [files, driverNames]);
  const tracks = useMemo(() => getTrackStats(files, driverNames), [files, driverNames]);
  const cars = useMemo(() => getCarStats(files, driverNames), [files, driverNames]);

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="animate-in animate-in-1">
          <StatCard label="Sessions" value={stats.totalSessions} icon={<Flag className="w-3.5 h-3.5" />}
            sub={`${stats.totalPractice}P · ${stats.totalQualifying}Q · ${stats.totalRaces}R`} />
        </div>
        <div className="animate-in animate-in-2">
          <StatCard label="Total Laps" value={stats.totalLaps} icon={<Route className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-3">
          <StatCard label="Races" value={stats.totalRaces} icon={<Trophy className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-4">
          <StatCard label="Tracks" value={stats.tracksVisited} icon={<MapPin className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-5">
          <StatCard label="Cars" value={stats.carsUsed} icon={<Car className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-6">
          <StatCard label="Distance" value={formatDistance(stats.totalDistanceKm)} icon={<Gauge className="w-3.5 h-3.5" />} />
        </div>
      </div>

      {/* Safety & averages */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="animate-in animate-in-1">
          <StatCard label="Avg Laps / Race"
            value={stats.totalRaces > 0
              ? (stats.totalRaceLaps / stats.totalRaces).toFixed(1)
              : '–'} />
        </div>
        <div className="animate-in animate-in-2">
          <StatCard label="Incidents" value={stats.totalIncidents}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            accent={stats.totalIncidents > 0 ? 'text-racing-orange' : 'text-racing-green'} />
        </div>
        <div className="animate-in animate-in-3">
          <StatCard label="Penalties" value={stats.totalPenalties}
            icon={<Ban className="w-3.5 h-3.5" />}
            accent={stats.totalPenalties > 0 ? 'text-racing-red' : 'text-racing-green'} />
        </div>
        <div className="animate-in animate-in-4">
          <StatCard label="Track Limits" value={stats.totalTrackLimits}
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            accent={stats.totalTrackLimits > 0 ? 'text-racing-yellow' : 'text-racing-green'} />
        </div>
        <div className="animate-in animate-in-5">
          <StatCard label="Laps / Session"
            value={stats.totalSessions > 0 ? (stats.totalLaps / stats.totalSessions).toFixed(1) : '–'} />
        </div>
      </div>

      {/* Tracks — best lap per track */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-3">
        <DataCardHeader title="BEST LAP PER CIRCUIT">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{tracks.length} tracks</span>
          {onNavigate && (
            <button onClick={() => onNavigate('tracks')} className="ml-3 text-[10px] text-racing-muted hover:text-racing-red transition-colors cursor-pointer">View all →</button>
          )}
          <ExportButton columns={trackColumns} data={tracks} filename="lmu-track-statistics" />
        </DataCardHeader>
        <SortableTable<TrackStats>
          columns={trackColumns}
          data={tracks}
          rowKey={t => t.trackCourse}
          onRowClick={onNavigate ? (row) => onNavigate('tracks', row.trackCourse) : undefined}
        />
      </div>

      {/* Cars */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-4">
        <DataCardHeader title="CARS USED">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{cars.length} cars</span>
          {onNavigate && (
            <button onClick={() => onNavigate('cars')} className="ml-3 text-[10px] text-racing-muted hover:text-racing-red transition-colors cursor-pointer">View all →</button>
          )}
          <ExportButton columns={carColumns} data={cars} filename="lmu-cars-used" />
        </DataCardHeader>
        <SortableTable<CarStats>
          columns={carColumns}
          data={cars}
          rowKey={c => c.carType}
          onRowClick={onNavigate ? (row) => onNavigate('cars', row.carType) : undefined}
        />
      </div>
    </div>
  );
});
