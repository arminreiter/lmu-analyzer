import { Flag, MapPin, Car, Gauge, AlertTriangle, Ban, Route, ShieldAlert, Trophy } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, getOverviewStats, getTrackStats, getCarStats, type TrackStats, type CarStats } from '../lib/analytics';
import type { RaceFile } from '../lib/types';

const trackColumns: Column<TrackStats>[] = [
  {
    key: 'track', label: 'Circuit',
    sortValue: t => t.trackVenue,
    render: t => <span className="text-racing-text">{t.trackVenue}</span>,
  },
  {
    key: 'sessions', label: 'Sessions', align: 'right', mono: true, width: '90px',
    sortValue: t => t.sessionCount,
    render: t => t.sessionCount,
  },
  {
    key: 'laps', label: 'Laps', align: 'right', mono: true, width: '80px',
    sortValue: t => t.totalLaps,
    render: t => t.totalLaps,
  },
  {
    key: 'classes', label: 'Classes', align: 'right', width: '130px',
    sortable: false,
    render: t => <div className="flex gap-1 justify-end">{t.classes.map(c => <ClassBadge key={c} carClass={c} />)}</div>,
  },
  {
    key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '120px',
    sortValue: t => t.bestLapTime ?? Infinity,
    render: t => (
      <div>
        <span className="text-white font-medium">{formatLapTime(t.bestLapTime)}</span>
        {t.bestCar && <p className="text-[10px] text-racing-muted truncate">{t.bestCar}</p>}
      </div>
    ),
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
    key: 'sessions', label: 'Sessions', align: 'right', mono: true, width: '90px',
    sortValue: c => c.sessionCount,
    render: c => c.sessionCount,
  },
  {
    key: 'laps', label: 'Laps', align: 'right', mono: true, width: '80px',
    sortValue: c => c.totalLaps,
    render: c => c.totalLaps,
  },
  {
    key: 'tracks', label: 'Tracks', align: 'right', mono: true, width: '75px',
    sortValue: c => c.tracks.length,
    render: c => c.tracks.length,
  },
  {
    key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '120px',
    sortValue: c => c.bestLapTime ?? Infinity,
    render: c => (
      <div>
        <span className="text-white font-medium">{formatLapTime(c.bestLapTime)}</span>
        {c.bestTrack && <p className="text-[10px] text-racing-muted truncate">{c.bestTrack}</p>}
      </div>
    ),
  },
];

interface OverviewViewProps {
  files: RaceFile[];
  driverNames: string[];
  onViewChange?: (view: string) => void;
}

export function OverviewView({ files, driverNames, onViewChange }: OverviewViewProps) {
  const stats = getOverviewStats(files, driverNames);
  const tracks = getTrackStats(files, driverNames);
  const cars = getCarStats(files, driverNames);

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
          <StatCard label="Distance" value={`${Math.round(stats.totalDistanceKm).toLocaleString()} km`} icon={<Gauge className="w-3.5 h-3.5" />} />
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

      {/* Penalty Breakdown */}
      {stats.penaltyTypes.size > 0 && (
        <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-3">
          <div className="px-5 py-3 border-b border-racing-border flex items-center">
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Penalty Breakdown</h3>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-3">
            {Array.from(stats.penaltyTypes.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-racing-red/[0.06] border border-racing-red/15">
                  <span className="text-racing-red font-mono text-sm font-bold">{count}</span>
                  <span className="text-racing-text text-xs">{type}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tracks — best lap per track */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-3">
        <div className="px-5 py-3 border-b border-racing-border flex items-center">
          <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Best Lap per Circuit</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{tracks.length} tracks</span>
          {onViewChange && (
            <button onClick={() => onViewChange('tracks')} className="ml-3 text-[10px] text-racing-muted hover:text-racing-red transition-colors">View all →</button>
          )}
        </div>
        <SortableTable<TrackStats>
          columns={trackColumns}
          data={tracks}
          rowKey={t => t.trackVenue}
          onRowClick={onViewChange ? () => onViewChange('tracks') : undefined}
        />
      </div>

      {/* Cars */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-4">
        <div className="px-5 py-3 border-b border-racing-border flex items-center">
          <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Cars Used</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{cars.length} cars</span>
          {onViewChange && (
            <button onClick={() => onViewChange('cars')} className="ml-3 text-[10px] text-racing-muted hover:text-racing-red transition-colors">View all →</button>
          )}
        </div>
        <SortableTable<CarStats>
          columns={carColumns}
          data={cars}
          rowKey={c => c.carType}
          onRowClick={onViewChange ? () => onViewChange('cars') : undefined}
        />
      </div>
    </div>
  );
}
