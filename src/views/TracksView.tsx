import { useState, useMemo, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SessionLink } from '../components/SessionLink';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, formatSector, formatSpeed, getTrackStats, getPersonalBests, getAllSessionBests, getAllLaps, getDriverSessions, getChartTooltipStyle } from '../lib/analytics';
import type { RaceFile, PersonalBest } from '../lib/types';

type LapMode = 'car' | 'session' | 'all';

const MODE_LABELS: Record<LapMode, string> = {
  car: 'BEST LAP PER CAR',
  session: 'BEST LAP PER SESSION',
  all: 'ALL LAPS',
};

interface TracksViewProps {
  files: RaceFile[];
  driverNames: string[];
  initialTrack?: string | null;
  onNavigate?: (view: string, context?: string) => void;
}

export const TracksView = memo(function TracksView({ files, driverNames, initialTrack, onNavigate }: TracksViewProps) {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(initialTrack ?? null);
  const [lapMode, setLapMode] = useState<LapMode>('car');
  const tracks = useMemo(() => getTrackStats(files, driverNames), [files, driverNames]);
  const bestPerCar = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);
  const bestPerSession = useMemo(() => getAllSessionBests(files, driverNames), [files, driverNames]);
  const allLaps = useMemo(() => getAllLaps(files, driverNames), [files, driverNames]);
  const allSessions = useMemo(() => getDriverSessions(files, driverNames), [files, driverNames]);

  const track = selectedTrack ?? tracks[0]?.trackCourse;

  const lapSource = lapMode === 'all' ? allLaps : lapMode === 'session' ? bestPerSession : bestPerCar;
  const trackLaps = useMemo(() => lapSource.filter(b => b.trackCourse === track), [lapSource, track]);
  const trackSessions = useMemo(() => allSessions.filter(s => s.file.trackCourse === track), [allSessions, track]);

  // Lap time progression over sessions for this track
  const progressionData = useMemo(() => {
    const data: Array<{ session: string; lapTime: number; car: string }> = [];
    for (const { file, driver } of trackSessions) {
      if (driver.bestLapTime && driver.bestLapTime > 0) {
        data.push({
          session: file.timeString.slice(5, 16),
          lapTime: driver.bestLapTime,
          car: driver.carType,
        });
      }
    }
    return data;
  }, [trackSessions]);

  // Top speed progression
  const lapColumns: Column<PersonalBest>[] = useMemo(() => [
    { key: 'pos', label: '#', width: '35px', sortValue: r => r.lapTime,
      render: (_, i) => <span className="text-racing-muted font-mono text-xs">{i + 1}</span> },
    { key: 'car', label: 'Car', width: '18%', sortValue: r => r.carType,
      render: r => onNavigate
        ? <button onClick={(e) => { e.stopPropagation(); onNavigate('cars', r.carType); }} className="text-white cursor-pointer">{r.carType}</button>
        : <span className="text-white">{r.carType}</span> },
    { key: 'class', label: 'Class', width: '70px', sortValue: r => r.carClass,
      render: r => <ClassBadge carClass={r.carClass} /> },
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

  const sortedTrackLaps = useMemo(() => [...trackLaps].sort((a, b) => a.lapTime - b.lapTime), [trackLaps]);

  const speedData = useMemo(() => trackSessions.map(({ file, driver }) => {
    const maxSpeed = Math.max(...driver.laps.map(l => l.topSpeed));
    return {
      session: file.timeString.slice(5, 16),
      topSpeed: maxSpeed > 0 ? maxSpeed : null,
    };
  }).filter(d => d.topSpeed), [trackSessions]);

  return (
    <div className="space-y-6">
      {/* Track Selector */}
      <div className="flex gap-2 flex-wrap">
        {tracks.map(t => (
          <button
            key={t.trackCourse}
            onClick={() => setSelectedTrack(t.trackCourse)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer
              ${t.trackCourse === track
                ? 'bg-racing-red text-[#fff]'
                : 'bg-racing-card border border-racing-border text-racing-muted hover:text-white hover:border-racing-highlight'}`}
          >
            {t.trackCourse}
          </button>
        ))}
      </div>

      {track && (
        <>
          {/* Track Stats */}
          <div className="data-card carbon-fiber p-6">
            <h2 className="font-racing text-xl font-bold text-white tracking-wider mb-4">{track}</h2>
            {(() => {
              const totalLaps = trackSessions.reduce((sum, s) => sum + s.driver.totalLaps, 0);
              const validLaps = trackSessions.reduce((sum, s) => sum + s.driver.laps.filter(l => l.lapTime && l.lapTime > 0).length, 0);
              const invalidLaps = totalLaps - validLaps;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Sessions</p>
                    <p className="text-white text-lg font-bold">{trackSessions.length}</p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Total Laps</p>
                    <p className="text-white text-lg font-bold">{totalLaps}</p>
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
                    <p className="text-racing-muted text-xs uppercase">Best Lap</p>
                    <p className="text-white text-lg font-bold font-mono">
                      {formatLapTime(trackLaps[0]?.lapTime ?? null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-racing-muted text-xs uppercase">Track Length</p>
                    <p className="text-white text-lg font-bold">
                      {((files.find(f => f.trackCourse === track)?.trackLength ?? 0) / 1000).toFixed(2)} km
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Laps table */}
          <div className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={MODE_LABELS[lapMode]}>
              <span className="ml-auto mr-3 text-[10px] font-mono text-racing-muted/50">{trackLaps.length} laps</span>
              <FilterButtonGroup
                options={[{ value: 'car', label: 'Per Car' }, { value: 'session', label: 'Per Session' }, { value: 'all', label: 'All Laps' }]}
                value={lapMode}
                onChange={setLapMode}
              />
              <ExportButton columns={lapColumns} data={sortedTrackLaps} filename={`lmu-track-${(track ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`} />
            </DataCardHeader>
            <SortableTable<PersonalBest>
              columns={lapColumns}
              data={sortedTrackLaps}
              rowKey={r => `${r.carType}-${r.fileName}-${r.lapNumber}`}
            />
          </div>

          {/* Lap Time Progression */}
          {progressionData.length > 1 && (
            <div className="data-card carbon-fiber p-4">
              <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">LAP TIME PROGRESSION</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="session" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => formatLapTime(v)} />
                  <Tooltip
                    contentStyle={getChartTooltipStyle()}
                    labelStyle={{ color: document.documentElement.classList.contains('light') ? '#1f2937' : '#e5e7eb' }}
                    formatter={(v: unknown, _: unknown, entry: unknown) => [formatLapTime(v as number), (entry as { payload: { car: string } }).payload.car]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="lapTime" stroke="#e10600" strokeWidth={2} dot={{ fill: '#e10600', r: 3 }} name="Best Lap" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Speed Progression */}
          {speedData.length > 1 && (
            <div className="data-card carbon-fiber p-4">
              <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">TOP SPEED TREND</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={speedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="session" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={getChartTooltipStyle()}
                    formatter={(v: unknown) => [formatSpeed(Number(v)), 'Top Speed']}
                  />
                  <Line type="monotone" dataKey="topSpeed" stroke="#ff6d00" strokeWidth={2} dot={{ fill: '#ff6d00', r: 3 }} name="Top Speed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
});
