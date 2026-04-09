import { useState, useMemo, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable } from '../components/SortableTable';
import { formatLapTime, getTrackStats, getPersonalBests, getAllSessionBests, getDriverSessions } from '../lib/analytics';
import type { RaceFile, PersonalBest } from '../lib/types';

interface TracksViewProps {
  files: RaceFile[];
  driverNames: string[];
  initialTrack?: string | null;
}

export const TracksView = memo(function TracksView({ files, driverNames, initialTrack }: TracksViewProps) {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(initialTrack ?? null);
  const [showAll, setShowAll] = useState(false);
  const tracks = useMemo(() => getTrackStats(files, driverNames), [files, driverNames]);
  const bests = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);
  const allBests = useMemo(() => getAllSessionBests(files, driverNames), [files, driverNames]);
  const allSessions = useMemo(() => getDriverSessions(files, driverNames), [files, driverNames]);

  const track = selectedTrack ?? tracks[0]?.trackVenue;
  const trackBests = useMemo(() => (showAll ? allBests : bests).filter(b => b.trackVenue === track), [showAll, allBests, bests, track]);
  const trackSessions = useMemo(() => allSessions.filter(s => s.file.trackVenue === track), [allSessions, track]);

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
            key={t.trackVenue}
            onClick={() => setSelectedTrack(t.trackVenue)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer
              ${t.trackVenue === track
                ? 'bg-racing-red text-white'
                : 'bg-racing-card border border-racing-border text-racing-muted hover:text-white hover:border-racing-highlight'}`}
          >
            {t.trackVenue}
          </button>
        ))}
      </div>

      {track && (
        <>
          {/* Track Stats */}
          <div className="data-card carbon-fiber p-6">
            <h2 className="font-racing text-xl font-bold text-white tracking-wider mb-4">{track}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-racing-muted text-xs uppercase">Sessions</p>
                <p className="text-white text-lg font-bold">{trackSessions.length}</p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Total Laps</p>
                <p className="text-white text-lg font-bold">
                  {trackSessions.reduce((sum, s) => sum + s.driver.totalLaps, 0)}
                </p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Best Lap</p>
                <p className="text-white text-lg font-bold font-mono">
                  {formatLapTime(trackBests[0]?.lapTime ?? null)}
                </p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Track Length</p>
                <p className="text-white text-lg font-bold">
                  {((files.find(f => f.trackVenue === track)?.trackLength ?? 0) / 1000).toFixed(2)} km
                </p>
              </div>
            </div>
          </div>

          {/* Personal Bests at this track */}
          <div className="data-card carbon-fiber overflow-hidden">
            <div className="px-5 py-3 border-b border-racing-border flex items-center justify-between">
              <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">BEST LAPS BY CAR</h3>
              <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium">
                <button onClick={() => setShowAll(false)} className={`px-3 py-1.5 transition-colors cursor-pointer ${!showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}>Best</button>
                <button onClick={() => setShowAll(true)} className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}>All</button>
              </div>
            </div>
            <SortableTable<PersonalBest>
              columns={[
                { key: 'pos', label: '#', width: '35px', sortValue: r => r.lapTime,
                  render: (_, i) => <span className="text-racing-muted font-mono text-xs">{i + 1}</span> },
                { key: 'car', label: 'Car', width: '18%', sortValue: r => r.carType,
                  render: r => <span className="text-white">{r.carType}</span> },
                { key: 'class', label: 'Class', width: '70px', sortValue: r => r.carClass,
                  render: r => <ClassBadge carClass={r.carClass} /> },
                { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '95px', sortValue: r => r.lapTime,
                  render: r => <span className="text-white font-bold">{formatLapTime(r.lapTime)}</span> },
                { key: 's1', label: 'S1', align: 'right', mono: true, width: '70px', sortValue: r => r.sector1,
                  render: r => <span className="text-racing-muted">{r.sector1?.toFixed(3) ?? '--'}</span> },
                { key: 's2', label: 'S2', align: 'right', mono: true, width: '70px', sortValue: r => r.sector2,
                  render: r => <span className="text-racing-muted">{r.sector2?.toFixed(3) ?? '--'}</span> },
                { key: 's3', label: 'S3', align: 'right', mono: true, width: '70px', sortValue: r => r.sector3,
                  render: r => <span className="text-racing-muted">{r.sector3?.toFixed(3) ?? '--'}</span> },
                { key: 'speed', label: 'Speed', align: 'right', mono: true, width: '75px', sortValue: r => r.topSpeed,
                  render: r => <span className="text-white/70">{r.topSpeed.toFixed(0)} km/h</span> },
                { key: 'session', label: 'Session', width: '85px', sortValue: r => r.sessionType,
                  render: r => <span className="text-racing-muted text-xs">{r.sessionType} L{r.lapNumber}</span> },
                { key: 'date', label: 'Date', width: '105px', sortValue: r => r.date,
                  render: r => <span className="text-racing-muted/60 text-xs">{r.date}</span> },
              ]}
              data={trackBests.sort((a, b) => a.lapTime - b.lapTime)}
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
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
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
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [`${Number(v).toFixed(1)} km/h`, 'Top Speed']}
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
