import { SessionLink } from './SessionLink';
import type { Column } from './SortableTable';
import { formatLapTime, formatSector, formatSpeed } from '../lib/formatting';
import type { PersonalBest } from '../lib/types';

/** Lap time / sector / speed / session / date columns shared by TracksView and CarsView.
 *  Callers prepend their own leading columns (track, car, class, ...). */
export function buildLapColumns(onNavigate?: (view: string, context?: string) => void): Column<PersonalBest>[] {
  return [
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
        ? <SessionLink fileName={r.fileName} sessionIndex={r.sessionIndex} driverName={r.driverName} onNavigate={onNavigate}>{r.sessionType} L{r.lapNumber}</SessionLink>
        : <span className="text-racing-muted text-xs">{r.sessionType} L{r.lapNumber}</span> },
    { key: 'date', label: 'Date', width: '105px', sortValue: r => r.date,
      render: r => <span className="text-racing-muted/60 text-xs">{r.date}</span> },
  ];
}
