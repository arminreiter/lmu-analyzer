import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, getCarStats, getDriverSessions, getPersonalBests, getAllSessionBests } from '../lib/analytics';
import type { RaceFile, PersonalBest } from '../lib/types';

interface CarsViewProps {
  files: RaceFile[];
  driverNames: string[];
}

export function CarsView({ files, driverNames }: CarsViewProps) {
  const [selectedCar, setSelectedCar] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const cars = getCarStats(files, driverNames);
  const bests = getPersonalBests(files, driverNames);
  const allBests = getAllSessionBests(files, driverNames);

  const car = selectedCar ?? cars[0]?.carType;
  const carInfo = cars.find(c => c.carType === car);
  const carBests = (showAll ? allBests : bests).filter(b => b.carType === car);
  const carSessions = getDriverSessions(files, driverNames).filter(s => s.driver.carType === car);

  // Lap time progression
  const progressionData = carSessions
    .filter(({ driver }) => driver.bestLapTime && driver.bestLapTime > 0)
    .map(({ file, driver }) => ({
      session: file.timeString.slice(5, 16),
      lapTime: driver.bestLapTime!,
      track: file.trackVenue,
    }));

  // Consistency analysis - standard deviation of lap times per session
  const consistencyData = carSessions.map(({ file, driver }) => {
    const validLaps = driver.laps.filter(l => l.lapTime && l.lapTime > 0).map(l => l.lapTime!);
    if (validLaps.length < 2) return null;
    const avg = validLaps.reduce((a, b) => a + b, 0) / validLaps.length;
    const variance = validLaps.reduce((sum, t) => sum + (t - avg) ** 2, 0) / validLaps.length;
    return {
      session: file.timeString.slice(5, 16),
      stdDev: Math.sqrt(variance),
      avg,
      track: file.trackVenue,
    };
  }).filter(Boolean) as Array<{ session: string; stdDev: number; avg: number; track: string }>;

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
                ? 'bg-racing-red text-white'
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
          <div className="bg-racing-card border border-racing-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-racing text-xl font-bold text-white tracking-wider">{car}</h2>
              <ClassBadge carClass={carInfo.carClass} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-racing-muted text-xs uppercase">Sessions</p>
                <p className="text-white text-lg font-bold">{carInfo.sessionCount}</p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Total Laps</p>
                <p className="text-white text-lg font-bold">{carInfo.totalLaps}</p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Best Lap</p>
                <p className="text-white text-lg font-bold font-mono">{formatLapTime(carInfo.bestLapTime)}</p>
              </div>
              <div>
                <p className="text-racing-muted text-xs uppercase">Tracks</p>
                <p className="text-white text-lg font-bold">{carInfo.tracks.length}</p>
              </div>
            </div>
          </div>

          {/* Best by Track */}
          <div className="data-card overflow-hidden">
            <div className="px-5 py-3 border-b border-racing-border flex items-center justify-between">
              <h3 className="font-racing text-xs font-bold text-white tracking-[0.1em]">BEST LAPS BY TRACK</h3>
              <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium">
                <button onClick={() => setShowAll(false)} className={`px-3 py-1.5 transition-colors cursor-pointer ${!showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}>Best</button>
                <button onClick={() => setShowAll(true)} className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}>All</button>
              </div>
            </div>
            <SortableTable<PersonalBest>
              columns={[
                { key: 'track', label: 'Track', width: '22%', sortValue: r => r.trackVenue,
                  render: r => <span className="text-white">{r.trackVenue}</span> },
                { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '95px', sortValue: r => r.lapTime,
                  render: r => <span className="text-white font-bold">{formatLapTime(r.lapTime)}</span> },
                { key: 's1', label: 'S1', align: 'right', mono: true, width: '70px', sortValue: r => r.sector1,
                  render: r => <span className="text-racing-muted">{r.sector1?.toFixed(3) ?? '--'}</span> },
                { key: 's2', label: 'S2', align: 'right', mono: true, width: '70px', sortValue: r => r.sector2,
                  render: r => <span className="text-racing-muted">{r.sector2?.toFixed(3) ?? '--'}</span> },
                { key: 's3', label: 'S3', align: 'right', mono: true, width: '70px', sortValue: r => r.sector3,
                  render: r => <span className="text-racing-muted">{r.sector3?.toFixed(3) ?? '--'}</span> },
                { key: 'speed', label: 'Speed', align: 'right', mono: true, width: '75px', sortValue: r => r.topSpeed,
                  render: r => <span className="text-racing-orange">{r.topSpeed.toFixed(0)} km/h</span> },
                { key: 'session', label: 'Session', width: '85px', sortValue: r => r.sessionType,
                  render: r => <span className="text-racing-muted text-xs">{r.sessionType} L{r.lapNumber}</span> },
                { key: 'date', label: 'Date', width: '105px', sortValue: r => r.date,
                  render: r => <span className="text-racing-muted/60 text-xs">{r.date}</span> },
              ]}
              data={carBests.sort((a, b) => a.trackVenue.localeCompare(b.trackVenue))}
              rowKey={r => `${r.trackVenue}-${r.fileName}-${r.lapNumber}`}
            />
          </div>

          {/* Lap Time Progression */}
          {progressionData.length > 1 && (
            <div className="bg-racing-card border border-racing-border rounded-xl p-4">
              <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">PERFORMANCE OVER TIME</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="session" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => formatLapTime(v)} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown, _: unknown, entry: unknown) => [formatLapTime(v as number), (entry as { payload: { track: string } }).payload.track]}
                  />
                  <Line type="monotone" dataKey="lapTime" stroke="#e10600" strokeWidth={2} dot={{ fill: '#e10600', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Consistency */}
          {consistencyData.length > 1 && (
            <div className="bg-racing-card border border-racing-border rounded-xl p-4">
              <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">CONSISTENCY (LAP TIME STD DEV)</h3>
              <p className="text-racing-muted text-xs mb-3">Lower is more consistent</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={consistencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="session" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown, _: unknown, entry: unknown) => [`${Number(v).toFixed(3)}s`, (entry as { payload: { track: string } }).payload.track]}
                  />
                  <Line type="monotone" dataKey="stdDev" stroke="#9c27b0" strokeWidth={2} dot={{ fill: '#9c27b0', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
