import { useState, useMemo, memo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { StatCard } from '../components/StatCard';
import { getRaceResults, isDnf, isOnline, isRatedRace, isDriverIncident, type RaceResult } from '../lib/analytics';
import { formatLapTime, getChartTooltipStyle, CHART_AXIS_TICK, CHART_GRID_STROKE } from '../lib/formatting';
import { buildSessionContext } from '../lib/sessionContext';
import type { RaceFile } from '../lib/types';

type RaceRow = RaceResult & {
  incidentCount: number;
  driverPenalties: RaceResult['session']['penalties'];
};

interface RaceResultsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const RaceResultsView = memo(function RaceResultsView({ files, driverNames, onNavigate }: RaceResultsViewProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'rated'>('all');
  const allResults = useMemo(() => getRaceResults(files, driverNames), [files, driverNames]);
  const results = useMemo(() => {
    let filtered = allResults;
    if (filter === 'online') filtered = allResults.filter(r => isOnline(r.file));
    if (filter === 'rated') filtered = allResults.filter(r => isRatedRace(r.file));
    // Precompute per-row incident/penalty data once, so columns don't re-filter in sortValue/render
    return filtered.map((r): RaceRow => ({
      ...r,
      incidentCount: r.session.incidents.filter(i => isDriverIncident(i, r.driver.name)).length,
      driverPenalties: r.session.penalties.filter(p => p.driver === r.driver.name),
    }));
  }, [allResults, filter]);

  const positionData = useMemo(() => results.map((r, i) => ({
    race: `${r.file.trackCourse.slice(0, 12)} ${r.file.timeString.slice(5, 10)}`,
    position: r.classPosition,
    total: r.classDrivers,
    idx: i,
  })).reverse(), [results]);

  // Stats
  const totalRaces = results.length;
  const wins = results.filter(r => r.classPosition === 1).length;
  const podiums = results.filter(r => r.classPosition <= 3).length;
  const top5 = results.filter(r => r.classPosition <= 5).length;
  const avgPosition = totalRaces > 0
    ? (results.reduce((sum, r) => sum + r.classPosition, 0) / totalRaces).toFixed(1)
    : '--';
  const dnfs = results.filter(r => isDnf(r.driver.finishStatus)).length;

  const raceColumns: Column<RaceRow>[] = useMemo(() => [
    { key: 'date', label: 'Date', width: '13%', sortValue: r => r.file.timeString,
      render: r => <span className="text-racing-muted text-xs">{r.file.timeString}</span> },
    { key: 'track', label: 'Track', width: '18%', sortValue: r => r.file.trackCourse,
      render: r => <span className="text-white">{r.file.trackCourse}</span> },
    { key: 'car', label: 'Car', width: '18%', sortValue: r => r.driver.carType,
      render: r => <div className="flex items-center gap-2"><span className="text-racing-text text-xs">{r.driver.carType}</span><ClassBadge carClass={r.driver.carClass} /></div> },
    { key: 'grid', label: 'Grid', align: 'center', width: '55px', sortValue: r => r.driver.classGridPosition ?? 999,
      render: r => <span className="text-racing-muted">{r.driver.classGridPosition ? `P${r.driver.classGridPosition}` : '--'}</span> },
    { key: 'finish', label: 'Finish', align: 'center', width: '70px', sortValue: r => r.classPosition,
      render: r => <><span className={`font-bold ${r.classPosition === 1 ? 'text-racing-gold' : r.classPosition <= 3 ? 'text-racing-orange' : 'text-white'}`}>P{r.classPosition}</span><span className="text-racing-muted text-xs">/{r.classDrivers}</span></> },
    { key: 'gain', label: 'Gain', align: 'center', width: '55px',
      sortValue: r => r.driver.classGridPosition ? r.driver.classGridPosition - r.classPosition : null,
      render: r => {
        const gain = r.driver.classGridPosition ? r.driver.classGridPosition - r.classPosition : null;
        if (gain === null) return null;
        if (gain === 0) return <Minus className="w-3 h-3 text-racing-muted mx-auto" />;
        return <span className={`flex items-center justify-center gap-0.5 text-xs font-bold ${gain > 0 ? 'text-racing-green' : 'text-racing-red'}`}>{gain > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(gain)}</span>;
      } },
    { key: 'bestLap', label: 'Best Lap', align: 'right', mono: true, width: '10%',
      sortValue: r => r.driver.bestLapTime,
      render: r => <span className="text-white font-mono">{formatLapTime(r.driver.bestLapTime)}</span> },
    { key: 'laps', label: 'Laps', align: 'right', width: '50px', sortValue: r => r.driver.totalLaps,
      render: r => <span className="text-racing-muted">{r.driver.totalLaps}</span> },
    { key: 'pits', label: 'Pits', align: 'right', width: '45px', sortValue: r => r.driver.pitstops,
      render: r => <span className="text-racing-muted">{r.driver.pitstops}</span> },
    { key: 'incidents', label: 'Inc', align: 'center', width: '45px',
      sortValue: r => r.incidentCount,
      render: r => r.incidentCount > 0 ? <span className="text-racing-orange font-mono">{r.incidentCount}</span> : <span className="text-racing-muted/30">0</span> },
    { key: 'penalties', label: 'Pen', align: 'center', width: '45px',
      sortValue: r => r.driverPenalties.length,
      render: r => {
        if (r.driverPenalties.length === 0) return <span className="text-racing-muted/30">0</span>;
        const types = r.driverPenalties.map(p => p.type).join(', ');
        return <span className="text-racing-red font-mono" title={types}>{r.driverPenalties.length}</span>;
      } },
    { key: 'status', label: 'Status', width: '10%', sortValue: r => r.driver.finishStatus,
      render: r => <span className={`text-xs ${r.driver.finishStatus === 'Finished Normally' ? 'text-racing-green' : 'text-racing-red'}`}>{r.driver.finishStatus}</span> },
  ], []);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <FilterButtonGroup
        options={[{ value: 'all', label: 'All Races' }, { value: 'online', label: 'Online' }, { value: 'rated', label: 'Rated' }]}
        value={filter}
        onChange={setFilter}
      />

      {/* Race Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard variant="center" label="Races" value={totalRaces} />
        <StatCard variant="center" label="Wins" value={wins} accent="text-racing-gold" />
        <StatCard variant="center" label="Podiums" value={podiums} accent="text-racing-orange" />
        <StatCard variant="center" label="Top 5" value={top5} accent="text-racing-blue" />
        <StatCard variant="center" label="Avg Pos" value={avgPosition} />
        <StatCard variant="center" label="DNFs" value={dnfs} accent={dnfs > 0 ? 'text-racing-red' : 'text-racing-green'} />
      </div>

      {/* Position Chart */}
      {positionData.length > 0 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">CLASS POSITION HISTORY</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={positionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="race" tick={{ fill: CHART_AXIS_TICK, fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
              <YAxis reversed tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} domain={[1, 'auto']} allowDecimals={false} />
              <Tooltip
                contentStyle={getChartTooltipStyle()}
                formatter={(v: unknown, _: unknown, entry: unknown) => [`P${v} / ${(entry as { payload: { total: number } }).payload.total}`, 'Position']}
              />
              <Bar dataKey="position" radius={[4, 4, 0, 0]}>
                {positionData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.position === 1 ? '#d4a843' : entry.position <= 3 ? '#ff6d00' : entry.position <= 5 ? '#2196f3' : '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Race List */}
      <div className="data-card carbon-fiber overflow-hidden">
        <DataCardHeader title="RACE HISTORY">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{results.length} races</span>
          <ExportButton columns={raceColumns} data={results} filename="lmu-race-results" />
        </DataCardHeader>
        <SortableTable<RaceRow>
          columns={raceColumns}
          data={results}
          rowKey={(r, i) => `${r.file.fileName}-${i}`}
          onRowClick={onNavigate ? (row) => onNavigate('session', buildSessionContext(row.file.fileName, row.session.sessionIndex, row.driver.name)) : undefined}
        />
      </div>

      {results.length === 0 && (
        <div className="text-center py-12 text-racing-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No race results found for this driver.</p>
        </div>
      )}
    </div>
  );
});
