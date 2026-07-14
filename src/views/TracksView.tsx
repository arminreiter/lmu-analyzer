import { useState, useMemo, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { PillSelector } from '../components/PillSelector';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { buildLapColumns } from '../components/lapColumns';
import { StatCell, LapValidityCell } from '../components/StatCell';
import { isValidLap } from '../lib/analytics';
import { formatLapTime, formatSpeed, getChartTooltipStyle, CHART_AXIS_TICK, CHART_GRID_STROKE } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
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

export const TracksView = memo(function TracksView({ files, initialTrack, onNavigate }: TracksViewProps) {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(initialTrack ?? null);
  const [lapMode, setLapMode] = useState<LapMode>('car');
  const { trackStats: tracks, personalBests: bestPerCar, allSessionBests: bestPerSession, allLaps, driverSessions: allSessions } = useDataIndex();

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

  const lapColumns: Column<PersonalBest>[] = useMemo(() => [
    { key: 'pos', label: '#', width: '35px', sortValue: (r: PersonalBest) => r.lapTime,
      render: (_: PersonalBest, i: number) => <span className="text-racing-muted font-mono text-xs">{i + 1}</span> },
    { key: 'car', label: 'Car', width: '18%', sortValue: (r: PersonalBest) => r.carType,
      render: (r: PersonalBest) => onNavigate
        ? <button onClick={(e) => { e.stopPropagation(); onNavigate('cars', r.carType); }} className="text-white cursor-pointer">{r.carType}</button>
        : <span className="text-white">{r.carType}</span> },
    { key: 'class', label: 'Class', width: '100px', sortValue: (r: PersonalBest) => r.carClass,
      render: (r: PersonalBest) => <ClassBadge carClass={r.carClass} /> },
    ...buildLapColumns(onNavigate),
  ], [onNavigate]);

  const lapCounts = useMemo(() => {
    const totalLaps = trackSessions.reduce((sum, s) => sum + s.driver.totalLaps, 0);
    const validLaps = trackSessions.reduce((sum, s) => sum + s.driver.laps.filter(isValidLap).length, 0);
    return { totalLaps, validLaps, invalidLaps: totalLaps - validLaps };
  }, [trackSessions]);

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
      <PillSelector items={tracks} itemKey={t => t.trackCourse} selected={track} onSelect={setSelectedTrack}>
        {t => t.trackCourse}
      </PillSelector>

      {track && (
        <>
          {/* Track Stats */}
          <div className="data-card carbon-fiber p-6">
            <h2 className="font-racing text-xl font-bold text-white tracking-wider mb-4">{track}</h2>
            {(() => {
              const { totalLaps, validLaps, invalidLaps } = lapCounts;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <StatCell label="Sessions" value={trackSessions.length} />
                  <StatCell label="Total Laps" value={totalLaps} />
                  <LapValidityCell valid={validLaps} invalid={invalidLaps} />
                  <StatCell label="Best Lap" mono value={formatLapTime(trackLaps[0]?.lapTime ?? null)} />
                  <StatCell label="Track Length" value={`${((files.find(f => f.trackCourse === track)?.trackLength ?? 0) / 1000).toFixed(2)} km`} />
                </div>
              );
            })()}
          </div>

          {/* Laps table */}
          <div className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={MODE_LABELS[lapMode]}>
              <span className="mr-1 text-[10px] font-mono text-racing-muted/50">{trackLaps.length} laps</span>
              <FilterButtonGroup
                options={[{ value: 'car', label: 'Per Car' }, { value: 'session', label: 'Per Session' }, { value: 'all', label: 'All Laps' }]}
                value={lapMode}
                onChange={setLapMode}
              />
              <ExportButton columns={lapColumns} data={sortedTrackLaps} filename={`lmu-track-${track ?? 'unknown'}`} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="session" tick={{ fill: CHART_AXIS_TICK, fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => formatLapTime(v)} />
                  <Tooltip
                    contentStyle={getChartTooltipStyle()}
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
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="session" tick={{ fill: CHART_AXIS_TICK, fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} domain={['auto', 'auto']} />
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
