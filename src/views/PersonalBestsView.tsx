import { useState, useMemo, memo } from 'react';
import { Trophy, Zap } from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, getPersonalBests, getAllSessionBests, getTheoreticalBest } from '../lib/analytics';
import type { RaceFile, CarClass, PersonalBest } from '../lib/types';

interface PersonalBestsViewProps {
  files: RaceFile[];
  driverNames: string[];
}

export const PersonalBestsView = memo(function PersonalBestsView({ files, driverNames }: PersonalBestsViewProps) {
  const [filterClass, setFilterClass] = useState<CarClass | 'All'>('All');
  const [filterTrack, setFilterTrack] = useState<string>('All');
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const bestOnly = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);
  const allSessions = useMemo(() => getAllSessionBests(files, driverNames), [files, driverNames]);
  const allBests = showAll ? allSessions : bestOnly;
  const classes = Array.from(new Set(allBests.map(b => b.carClass)));
  const tracks = Array.from(new Set(allBests.map(b => b.trackVenue))).sort();

  const filtered = useMemo(() => allBests.filter(b => {
    if (filterClass !== 'All' && b.carClass !== filterClass) return false;
    if (filterTrack !== 'All' && b.trackVenue !== filterTrack) return false;
    return true;
  }), [allBests, filterClass, filterTrack]);

  const grouped = useMemo(() => {
    const map = new Map<string, PersonalBest[]>();
    for (const b of filtered) {
      const arr = map.get(b.trackVenue) ?? [];
      arr.push(b);
      map.set(b.trackVenue, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-[10px] uppercase tracking-wider">Class:</label>
          <SearchableSelect value={filterClass} options={[{ value: 'All', label: 'All Classes' }, ...classes.map(c => ({ value: c, label: c }))]} onChange={v => setFilterClass(v as CarClass | 'All')} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-[10px] uppercase tracking-wider">Track:</label>
          <SearchableSelect value={filterTrack} options={[{ value: 'All', label: 'All Tracks' }, ...tracks.map(t => ({ value: t, label: t }))]} onChange={setFilterTrack} />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 transition-colors cursor-pointer ${!showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}
          >Best per Car</button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-racing-border ${showAll ? 'bg-racing-red text-white' : 'bg-racing-card text-racing-muted hover:text-white'}`}
          >All Sessions</button>
        </div>
        <button onClick={() => setShowTheoretical(!showTheoretical)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
            ${showTheoretical ? 'bg-racing-purple/15 text-racing-purple border border-racing-purple/25' : 'bg-racing-card border border-racing-border text-racing-muted hover:text-racing-text'}`}>
          <Zap className="w-3 h-3" /> Theoretical Best
        </button>
      </div>

      {Array.from(grouped.entries()).map(([track, bests]) => {
        const defaultSorted = [...bests].sort((a, b) => a.lapTime - b.lapTime);
        let bestS1 = Infinity, bestS2 = Infinity, bestS3 = Infinity;
        for (const b of defaultSorted) {
          if (b.sector1 && b.sector1 < bestS1) bestS1 = b.sector1;
          if (b.sector2 && b.sector2 < bestS2) bestS2 = b.sector2;
          if (b.sector3 && b.sector3 < bestS3) bestS3 = b.sector3;
        }
        const fastestLap = defaultSorted[0]?.lapTime ?? Infinity;

        const columns: Column<PersonalBest>[] = [
          { key: 'pos', label: '#', width: '40px',
            sortValue: r => r.lapTime,
            render: (_, i) => i === 0 ? <Trophy className="w-4 h-4 text-racing-gold" /> : i === 1 ? <Trophy className="w-4 h-4 text-racing-silver" /> : i === 2 ? <Trophy className="w-4 h-4 text-racing-bronze" /> : <span className="text-racing-muted/40 font-mono text-xs">{i + 1}</span> },
          { key: 'car', label: 'Car', width: '22%', sortValue: r => r.carType,
            render: r => <span className="text-white text-xs">{r.carType}</span> },
          { key: 'class', label: 'Class', width: '65px', sortValue: r => r.carClass,
            render: r => <ClassBadge carClass={r.carClass} /> },
          { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '10%',
            sortValue: r => r.lapTime,
            render: r => <span className={`font-bold ${r.lapTime === fastestLap ? 'text-racing-gold' : 'text-white'}`}>{formatLapTime(r.lapTime)}</span> },
          { key: 's1', label: 'S1', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector1,
            render: r => <span className={r.sector1 !== null && r.sector1 <= bestS1 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector1?.toFixed(3) ?? '--'}</span> },
          { key: 's2', label: 'S2', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector2,
            render: r => <span className={r.sector2 !== null && r.sector2 <= bestS2 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector2?.toFixed(3) ?? '--'}</span> },
          { key: 's3', label: 'S3', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector3,
            render: r => <span className={r.sector3 !== null && r.sector3 <= bestS3 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector3?.toFixed(3) ?? '--'}</span> },
          { key: 'speed', label: 'Top Speed', align: 'right', mono: true, width: '9%',
            sortValue: r => r.topSpeed,
            render: r => <span className="text-white/70">{r.topSpeed.toFixed(0)} km/h</span> },
          { key: 'session', label: 'Session', width: '10%',
            sortValue: r => r.sessionType,
            render: r => <span className="text-racing-muted text-xs">{r.sessionType} &mdash; L{r.lapNumber}</span> },
          { key: 'date', label: 'Date', width: '12%',
            sortValue: r => r.date,
            render: r => <span className="text-racing-muted/60 text-xs">{r.date}</span> },
        ];

        const theoreticalRows = showTheoretical ? (() => {
          const carTypes = Array.from(new Set(bests.map(b => b.carType)));
          return carTypes.map(carType => {
            const tb = getTheoreticalBest(files, driverNames, track, carType);
            if (!tb.total) return null;
            const best = bests.find(b => b.carType === carType);
            return (
              <tr key={`theo-${carType}`} className="border-b border-racing-border/30 bg-racing-purple/[0.04]">
                <td className="px-4 py-2"><Zap className="w-3 h-3 text-racing-purple" /></td>
                <td className="px-4 py-2 text-racing-purple/80 text-xs">{carType} (theoretical)</td>
                <td className="px-4 py-2"><ClassBadge carClass={best?.carClass ?? 'Unknown'} /></td>
                <td className="px-4 py-2 text-right font-mono text-racing-purple font-bold glow-purple">{formatLapTime(tb.total)}</td>
                <td className="px-4 py-2 text-right font-mono text-racing-purple/70">{tb.s1?.toFixed(3) ?? '--'}</td>
                <td className="px-4 py-2 text-right font-mono text-racing-purple/70">{tb.s2?.toFixed(3) ?? '--'}</td>
                <td className="px-4 py-2 text-right font-mono text-racing-purple/70">{tb.s3?.toFixed(3) ?? '--'}</td>
                <td className="px-4 py-2 text-right text-racing-muted/40">&mdash;</td>
                <td className="px-4 py-2 text-racing-muted/40 text-xs">&mdash;</td>
                <td className="px-4 py-2 text-racing-muted/40 text-xs">&mdash;</td>
              </tr>
            );
          });
        })() : null;

        return (
          <div key={track} className="data-card carbon-fiber overflow-hidden">
            <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
              <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">{track.toUpperCase()}</h3>
            </div>
            <SortableTable
              columns={columns}
              data={defaultSorted}
              rowKey={r => `${r.carType}-${r.fileName}-${r.lapNumber}`}
              rowClass={r => r.lapTime === fastestLap ? 'bg-racing-gold/[0.03]' : ''}
              stickyRows={<>{theoreticalRows}</>}
            />
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-racing-muted"><p>No lap times found for the selected filters.</p></div>
      )}
    </div>
  );
});
