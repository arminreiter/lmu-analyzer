import { useMemo, useState, memo } from 'react';
import { ClassBadge } from '../components/ClassBadge';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, getDriverSessions, isRatedRace } from '../lib/analytics';
import type { RaceFile, DriverResult, SessionData } from '../lib/types';

interface SessionsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

type SessionRow = { file: RaceFile; session: SessionData; driver: DriverResult };

export const SessionsView = memo(function SessionsView({ files, driverNames, onNavigate }: SessionsViewProps) {
  const [filterSetting, setFilterSetting] = useState<'all' | 'online' | 'rated'>('all');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTrack, setFilterTrack] = useState<string>('All');

  const allSessions = useMemo(() => getDriverSessions(files, driverNames), [files, driverNames]);
  const tracks = useMemo(() => Array.from(new Set(allSessions.map(s => s.file.trackVenue))).sort(), [allSessions]);

  const filtered = useMemo(() => allSessions
    .filter(s => {
      if (filterSetting === 'online') return s.file.setting === 'Multiplayer';
      if (filterSetting === 'rated') return isRatedRace(s.file);
      return true;
    })
    .filter(s => filterType === 'All' || s.session.type === filterType)
    .filter(s => filterTrack === 'All' || s.file.trackVenue === filterTrack)
    .sort((a, b) => b.file.timeString.localeCompare(a.file.timeString)), [allSessions, filterSetting, filterType, filterTrack]);

  const columns: Column<SessionRow>[] = useMemo(() => [
    { key: 'type', label: 'Type', width: '95px',
      sortValue: r => r.session.type,
      render: r => (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold
          ${r.session.type === 'Race' ? 'bg-racing-red/20 text-racing-red' :
            r.session.type === 'Qualifying' ? 'bg-racing-yellow/20 text-racing-yellow' :
            'bg-racing-blue/20 text-racing-blue'}`}>
          {r.session.type}
        </span>
      ),
    },
    { key: 'track', label: 'Track', width: '25%',
      sortValue: r => r.file.trackVenue,
      render: r => <span className="text-white text-sm font-medium">{r.file.trackVenue}</span>,
    },
    { key: 'class', label: 'Class', width: '70px',
      sortValue: r => r.driver.carClass,
      render: r => <ClassBadge carClass={r.driver.carClass} />,
    },
    { key: 'car', label: 'Car', width: '18%',
      sortValue: r => r.driver.carType,
      render: r => <span className="text-racing-muted text-xs">{r.driver.carType}</span>,
    },
    { key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '115px',
      sortValue: r => r.driver.bestLapTime ?? Infinity,
      render: r => <span className="text-racing-green">{formatLapTime(r.driver.bestLapTime)}</span>,
    },
    { key: 'laps', label: 'Laps', align: 'right', width: '50px',
      sortValue: r => r.driver.totalLaps,
      render: r => <span className="text-racing-muted">{r.driver.totalLaps}</span>,
    },
    { key: 'topspeed', label: 'Top Speed', align: 'right', width: '85px',
      sortValue: r => { const speeds = r.driver.laps.map(l => l.topSpeed).filter(s => s > 0); return speeds.length ? Math.max(...speeds) : 0; },
      render: r => { const speeds = r.driver.laps.map(l => l.topSpeed).filter(s => s > 0); const top = speeds.length ? Math.max(...speeds) : 0; return top ? <span className="text-racing-orange text-xs">{top.toFixed(0)} km/h</span> : <span className="text-racing-muted">--</span>; },
    },
    { key: 'consistency', label: 'Consist.', align: 'right', width: '70px',
      sortValue: r => { const times = r.driver.laps.filter(l => l.lapTime && l.lapTime > 0).map(l => l.lapTime!); if (times.length < 2) return 0; const avg = times.reduce((a, b) => a + b, 0) / times.length; const std = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length); return 100 - (std / avg) * 100; },
      render: r => { const times = r.driver.laps.filter(l => l.lapTime && l.lapTime > 0).map(l => l.lapTime!); if (times.length < 2) return <span className="text-racing-muted">--</span>; const avg = times.reduce((a, b) => a + b, 0) / times.length; const c = 100 - (Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length) / avg) * 100; return <span className={`text-xs ${c > 98 ? 'text-racing-green' : c > 95 ? 'text-racing-yellow' : 'text-racing-orange'}`}>{c.toFixed(1)}%</span>; },
    },
    { key: 'pos', label: 'Pos', align: 'right', width: '45px',
      sortValue: r => r.session.type === 'Race' ? r.driver.classPosition : Infinity,
      render: r => r.session.type === 'Race'
        ? <span className="text-racing-gold text-xs font-bold">P{r.driver.classPosition}</span>
        : null,
    },
    { key: 'gain', label: 'Gain', align: 'right', width: '50px',
      sortValue: r => r.session.type === 'Race' && r.driver.gridPosition ? r.driver.gridPosition - r.driver.position : 0,
      render: r => { if (r.session.type !== 'Race' || !r.driver.gridPosition) return null; const g = r.driver.gridPosition - r.driver.position; return <span className={`text-xs font-bold ${g > 0 ? 'text-racing-green' : g < 0 ? 'text-racing-red' : 'text-racing-muted'}`}>{g > 0 ? '+' : ''}{g}</span>; },
    },
    { key: 'date', label: 'Date', align: 'right', width: '155px',
      sortValue: r => r.file.timeString,
      render: r => <span className="text-racing-muted text-xs">{r.file.timeString}</span>,
    },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium w-fit">
          <button
            onClick={() => setFilterSetting('all')}
            className={`px-3 py-1.5 transition-colors cursor-pointer ${filterSetting === 'all' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
          >All</button>
          <button
            onClick={() => setFilterSetting('online')}
            className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${filterSetting === 'online' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
          >Online</button>
          <button
            onClick={() => setFilterSetting('rated')}
            className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${filterSetting === 'rated' ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
          >Rated</button>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium w-fit">
          {['All', 'Practice', 'Qualifying', 'Race'].map((t, i) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 transition-colors cursor-pointer ${i > 0 ? 'border-l border-racing-border' : ''} ${filterType === t ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
            >{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-xs uppercase tracking-wider">Track:</label>
          <SearchableSelect
            value={filterTrack}
            options={[
              { value: 'All', label: 'All Tracks' },
              ...tracks.map(t => ({ value: t, label: t })),
            ]}
            onChange={setFilterTrack}
          />
        </div>
        <span className="text-racing-muted text-xs">{filtered.length} sessions</span>
      </div>

      <div className="data-card carbon-fiber overflow-hidden">
        <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
          <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">SESSION HISTORY</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{filtered.length} sessions</span>
          <ExportButton columns={columns} data={filtered} filename="lmu-sessions" />
        </div>
        <SortableTable<SessionRow>
          columns={columns}
          data={filtered}
          rowKey={r => `${r.file.fileName}-${r.session.sessionIndex}`}
          onRowClick={r => onNavigate?.('session', `${r.file.fileName}::${r.session.sessionIndex}`)}
        />
      </div>
    </div>
  );
});
