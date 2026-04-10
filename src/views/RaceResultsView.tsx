import { useState, useMemo, memo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, getRaceResults, isRatedRace, isDriverIncident, CHART_TOOLTIP_STYLE, type RaceResult } from '../lib/analytics';
import type { RaceFile } from '../lib/types';

interface RaceResultsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const RaceResultsView = memo(function RaceResultsView({ files, driverNames, onNavigate }: RaceResultsViewProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'rated'>('all');
  const allResults = useMemo(() => getRaceResults(files, driverNames), [files, driverNames]);
  const results = useMemo(() => {
    if (filter === 'online') return allResults.filter(r => r.file.setting === 'Multiplayer');
    if (filter === 'rated') return allResults.filter(r => isRatedRace(r.file));
    return allResults;
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
  const dnfs = results.filter(r => r.driver.finishStatus !== 'Finished Normally').length;

  const raceColumns: Column<RaceResult>[] = [
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
      sortValue: r => r.session.incidents.filter(i => isDriverIncident(i, r.driver.name)).length,
      render: r => {
        const count = r.session.incidents.filter(i => isDriverIncident(i, r.driver.name)).length;
        return count > 0 ? <span className="text-racing-orange font-mono">{count}</span> : <span className="text-racing-muted/30">0</span>;
      } },
    { key: 'penalties', label: 'Pen', align: 'center', width: '45px',
      sortValue: r => r.session.penalties.filter(p => p.driver === r.driver.name).length,
      render: r => {
        const pens = r.session.penalties.filter(p => p.driver === r.driver.name);
        if (pens.length === 0) return <span className="text-racing-muted/30">0</span>;
        const types = pens.map(p => p.type).join(', ');
        return <span className="text-racing-red font-mono" title={types}>{pens.length}</span>;
      } },
    { key: 'status', label: 'Status', width: '10%', sortValue: r => r.driver.finishStatus,
      render: r => <span className={`text-xs ${r.driver.finishStatus === 'Finished Normally' ? 'text-racing-green' : 'text-racing-red'}`}>{r.driver.finishStatus}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 transition-colors cursor-pointer ${filter === 'all' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
        >All Races</button>
        <button
          onClick={() => setFilter('online')}
          className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${filter === 'online' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
        >Online</button>
        <button
          onClick={() => setFilter('rated')}
          className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${filter === 'rated' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
        >Rated</button>
      </div>

      {/* Race Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">Races</p>
          <p className="text-2xl font-bold text-white">{totalRaces}</p>
        </div>
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">Wins</p>
          <p className="text-2xl font-bold text-racing-gold">{wins}</p>
        </div>
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">Podiums</p>
          <p className="text-2xl font-bold text-racing-orange">{podiums}</p>
        </div>
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">Top 5</p>
          <p className="text-2xl font-bold text-racing-blue">{top5}</p>
        </div>
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">Avg Pos</p>
          <p className="text-2xl font-bold text-white">{avgPosition}</p>
        </div>
        <div className="data-card carbon-fiber p-4 text-center">
          <p className="text-racing-muted text-xs uppercase">DNFs</p>
          <p className={`text-2xl font-bold ${dnfs > 0 ? 'text-racing-red' : 'text-racing-green'}`}>{dnfs}</p>
        </div>
      </div>

      {/* Position Chart */}
      {positionData.length > 0 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">CLASS POSITION HISTORY</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={positionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="race" tick={{ fill: '#6b7280', fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
              <YAxis reversed tick={{ fill: '#6b7280', fontSize: 11 }} domain={[1, 'auto']} allowDecimals={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
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
        <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
          <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">RACE HISTORY</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{results.length} races</span>
          <ExportButton columns={raceColumns} data={results} filename="lmu-race-results" />
        </div>
        <SortableTable<RaceResult>
          columns={raceColumns}
          data={results}
          rowKey={(r, i) => `${r.file.fileName}-${i}`}
          onRowClick={onNavigate ? (row) => onNavigate('session', `${row.file.fileName}::${row.session.sessionIndex}`) : undefined}
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
