import { useMemo, useState, memo } from 'react';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { isRatedRace, calculateConsistency, getTopSpeed } from '../lib/analytics';
import { formatLapTime, formatSpeed, getConsistencyColor, getSessionTypeStyle } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
import type { RaceFile, DriverResult, SessionData } from '../lib/types';

interface SessionsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

type SessionRow = { file: RaceFile; session: SessionData; driver: DriverResult };

export const SessionsView = memo(function SessionsView({ onNavigate }: SessionsViewProps) {
  const [filterSetting, setFilterSetting] = useState<'all' | 'online' | 'rated'>('all');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTrack, setFilterTrack] = useState<string>('All');

  const { driverSessions: allSessions } = useDataIndex();
  const tracks = useMemo(() => Array.from(new Set(allSessions.map(s => s.file.trackCourse))).sort(), [allSessions]);

  const filtered = useMemo(() => allSessions
    .filter(s => {
      if (filterSetting === 'online') return s.file.setting === 'Multiplayer';
      if (filterSetting === 'rated') return isRatedRace(s.file);
      return true;
    })
    .filter(s => filterType === 'All' || s.session.type === filterType)
    .filter(s => filterTrack === 'All' || s.file.trackCourse === filterTrack)
    .sort((a, b) => (b.session.dateTime || b.file.timeString).localeCompare(a.session.dateTime || a.file.timeString)), [allSessions, filterSetting, filterType, filterTrack]);

  const columns: Column<SessionRow>[] = useMemo(() => [
    { key: 'type', label: 'Type', width: '95px',
      sortValue: r => r.session.type,
      render: r => (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${getSessionTypeStyle(r.session.type)}`}>
          {r.session.type}
        </span>
      ),
    },
    { key: 'track', label: 'Track', width: '25%',
      sortValue: r => r.file.trackCourse,
      render: r => <span className="text-white text-sm font-medium">{r.file.trackCourse}</span>,
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
      sortValue: r => getTopSpeed(r.driver.laps) ?? 0,
      render: r => { const top = getTopSpeed(r.driver.laps); return top ? <span className="text-white/70 text-xs">{formatSpeed(top)}</span> : <span className="text-racing-muted">--</span>; },
    },
    { key: 'consistency', label: 'Consist.', align: 'right', width: '70px',
      sortValue: r => calculateConsistency(r.driver.laps) ?? 0,
      render: r => { const c = calculateConsistency(r.driver.laps); if (c === null) return <span className="text-racing-muted">--</span>; return <span className={`text-xs ${getConsistencyColor(c)}`}>{c.toFixed(1)}%</span>; },
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
      sortValue: r => r.session.dateTime || r.file.timeString,
      render: r => <span className="text-racing-muted text-xs">{r.session.dateTime || r.file.timeString}</span>,
    },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <FilterButtonGroup
          options={[{ value: 'all', label: 'All' }, { value: 'online', label: 'Online' }, { value: 'rated', label: 'Rated' }]}
          value={filterSetting}
          onChange={setFilterSetting}
        />
        <FilterButtonGroup
          options={[{ value: 'All', label: 'All' }, { value: 'Practice', label: 'Practice' }, { value: 'Qualifying', label: 'Qualifying' }, { value: 'Race', label: 'Race' }]}
          value={filterType}
          onChange={setFilterType}
        />
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
        <DataCardHeader title="SESSION HISTORY">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{filtered.length} sessions</span>
          <ExportButton columns={columns} data={filtered} filename="lmu-sessions" />
        </DataCardHeader>
        <SortableTable<SessionRow>
          columns={columns}
          data={filtered}
          rowKey={r => `${r.file.fileName}-${r.session.sessionIndex}-${r.driver.name}`}
          onRowClick={r => onNavigate?.('session', `${r.file.fileName}::${r.session.sessionIndex}::${encodeURIComponent(r.driver.name)}`)}
        />
      </div>
    </div>
  );
});
