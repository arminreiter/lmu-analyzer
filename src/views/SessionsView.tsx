import { useMemo, useState, memo } from 'react';
import { ClassBadge } from '../components/ClassBadge';
import { SearchableSelect } from '../components/SearchableSelect';
import { formatLapTime, getDriverSessions } from '../lib/analytics';
import type { RaceFile, DriverResult, SessionData } from '../lib/types';

const SESSION_ROW_STYLE: React.CSSProperties = {
  gridTemplateColumns: '72px minmax(0, 200px) 55px minmax(0, 1fr) 85px 55px 130px 30px',
  alignItems: 'center',
  gap: '8px',
};

interface SessionsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}


function SessionDetail({ file, session, driver, onNavigate }: { file: RaceFile; session: SessionData; driver: DriverResult; onNavigate?: (view: string, context?: string) => void }) {
  const sessionId = `${file.fileName}::${session.sessionIndex}`;

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <button
        onClick={() => onNavigate?.('session', sessionId)}
        className="w-full px-4 py-3 grid hover:bg-racing-highlight/20 transition-colors cursor-pointer"
        style={SESSION_ROW_STYLE}
      >
        <span className={`px-2 py-0.5 rounded text-xs font-bold text-center
          ${session.type === 'Race' ? 'bg-racing-red/20 text-racing-red' :
            session.type === 'Qualifying' ? 'bg-racing-yellow/20 text-racing-yellow' :
            'bg-racing-blue/20 text-racing-blue'}`}>
          {session.type}
        </span>
        <span className="text-white text-sm font-medium truncate text-left">{file.trackVenue}</span>
        <ClassBadge carClass={driver.carClass} />
        <span className="text-racing-muted text-xs truncate text-left">{driver.carType}</span>
        <span className="font-mono text-sm text-racing-green text-right">{formatLapTime(driver.bestLapTime)}</span>
        <span className="text-racing-muted text-xs text-right">{driver.totalLaps} laps</span>
        <span className="text-racing-muted text-xs text-right">{file.timeString}</span>
        <span className="text-right">
          {session.type === 'Race'
            ? <span className="text-racing-gold text-xs font-bold">P{driver.classPosition}</span>
            : null}
        </span>
      </button>
    </div>
  );
}

export const SessionsView = memo(function SessionsView({ files, driverNames, onNavigate }: SessionsViewProps) {
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTrack, setFilterTrack] = useState<string>('All');

  const allSessions = useMemo(() => getDriverSessions(files, driverNames), [files, driverNames]);
  const tracks = useMemo(() => Array.from(new Set(allSessions.map(s => s.file.trackVenue))).sort(), [allSessions]);

  const filtered = useMemo(() => allSessions
    .filter(s => filterType === 'All' || s.session.type === filterType)
    .filter(s => filterTrack === 'All' || s.file.trackVenue === filterTrack)
    .sort((a, b) => b.file.timeString.localeCompare(a.file.timeString)), [allSessions, filterType, filterTrack]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-xs uppercase tracking-wider">Type:</label>
          <SearchableSelect
            value={filterType}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Practice', label: 'Practice' },
              { value: 'Qualifying', label: 'Qualifying' },
              { value: 'Race', label: 'Race' },
            ]}
            onChange={setFilterType}
          />
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

      {filtered.map(({ file, session, driver }) => (
        <SessionDetail
          key={`${file.fileName}-${session.sessionIndex}`}
          file={file}
          session={session}
          driver={driver}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
});
