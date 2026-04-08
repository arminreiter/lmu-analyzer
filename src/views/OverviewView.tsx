import { Flag, MapPin, Car, Gauge, AlertTriangle, Ban, Route } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { ClassBadge } from '../components/ClassBadge';
import { formatLapTime, getOverviewStats, getTrackStats, getCarStats } from '../lib/analytics';
import type { RaceFile } from '../lib/types';

interface OverviewViewProps {
  files: RaceFile[];
  driverNames: string[];
}

export function OverviewView({ files, driverNames }: OverviewViewProps) {
  const stats = getOverviewStats(files, driverNames);
  const tracks = getTrackStats(files, driverNames);
  const cars = getCarStats(files, driverNames);

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="animate-in animate-in-1">
          <StatCard label="Sessions" value={stats.totalSessions} icon={<Flag className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-2">
          <StatCard label="Total Laps" value={stats.totalLaps} icon={<Route className="w-3.5 h-3.5" />} />
        </div>
        <div className="animate-in animate-in-3">
          <StatCard label="Races" value={stats.totalRaces} />
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

      {/* Safety stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <StatCard label="Laps / Session"
            value={stats.totalSessions > 0 ? (stats.totalLaps / stats.totalSessions).toFixed(1) : '0'} />
        </div>
        <div className="animate-in animate-in-5">
          <StatCard label="Avg Laps / Race"
            value={stats.totalRaces > 0
              ? (stats.totalLaps / stats.totalRaces).toFixed(1)
              : '0'} />
        </div>
      </div>

      {/* Tracks — best lap per track (meaningful because each track has its own length) */}
      <div className="data-card overflow-hidden animate-in animate-in-3">
        <div className="px-5 py-3 border-b border-racing-border flex items-center gap-2">
          <div className="w-1 h-3 bg-racing-red rounded-full" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Best Lap per Circuit</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{tracks.length} tracks</span>
        </div>
        <div className="divide-y divide-racing-border/30">
          {tracks.map(t => (
            <div key={t.trackVenue}
              className="grid hover:bg-racing-highlight/10 transition-colors group px-5 py-3"
              style={{ gridTemplateColumns: '1fr 120px 110px', alignItems: 'center', gap: '12px' }}>
              <div className="min-w-0">
                <p className="text-sm text-racing-text group-hover:text-white transition-colors truncate">{t.trackVenue}</p>
                <p className="text-xs text-racing-muted font-mono">{t.sessionCount} sessions &middot; {t.totalLaps} laps</p>
              </div>
              <div className="flex gap-1 justify-end">{t.classes.map(c => <ClassBadge key={c} carClass={c} />)}</div>
              <div className="text-right">
                <span className="font-mono text-sm text-white font-medium">{formatLapTime(t.bestLapTime)}</span>
                {t.bestCar && <p className="text-[10px] text-racing-muted truncate">{t.bestCar}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cars */}
      <div className="data-card overflow-hidden animate-in animate-in-4">
        <div className="px-5 py-3 border-b border-racing-border flex items-center gap-2">
          <div className="w-1 h-3 bg-racing-blue rounded-full" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Cars Used</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{cars.length} cars</span>
        </div>
        <div className="divide-y divide-racing-border/30">
          {cars.map(c => (
            <div key={c.carType}
              className="grid hover:bg-racing-highlight/10 transition-colors group px-5 py-3"
              style={{ gridTemplateColumns: '1fr 65px 110px', alignItems: 'center', gap: '12px' }}>
              <div className="min-w-0">
                <p className="text-sm text-racing-text group-hover:text-white transition-colors truncate">{c.carType}</p>
                <p className="text-xs text-racing-muted font-mono">
                  {c.sessionCount} sessions &middot; {c.totalLaps} laps &middot; {c.tracks.length} track{c.tracks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex justify-end"><ClassBadge carClass={c.carClass} /></div>
              <div className="text-right">
                <span className="font-mono text-sm text-white font-medium">{formatLapTime(c.bestLapTime)}</span>
                {c.bestTrack && <p className="text-[10px] text-racing-muted truncate">{c.bestTrack}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
