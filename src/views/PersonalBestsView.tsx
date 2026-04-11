import { useState, useMemo, memo } from 'react';
import { Trophy, Zap } from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SessionLink } from '../components/SessionLink';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, formatSector, formatSpeed, getPersonalBests, getAllSessionBests, getAllLaps, getTheoreticalBest } from '../lib/analytics';
import type { RaceFile, PersonalBest } from '../lib/types';

type LapMode = 'car' | 'session' | 'all';

interface PersonalBestsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const PersonalBestsView = memo(function PersonalBestsView({ files, driverNames, onNavigate }: PersonalBestsViewProps) {
  const [filterTrack, setFilterTrack] = useState<string>('All');
  const [filterCar, setFilterCar] = useState<string>('All');
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [lapMode, setLapMode] = useState<LapMode>('car');

  const bestPerCar = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);
  const bestPerSession = useMemo(() => getAllSessionBests(files, driverNames), [files, driverNames]);
  const everyLap = useMemo(() => getAllLaps(files, driverNames), [files, driverNames]);
  const allBests = lapMode === 'all' ? everyLap : lapMode === 'session' ? bestPerSession : bestPerCar;
  const tracks = Array.from(new Set(allBests.map(b => b.trackCourse))).sort();
  const cars = Array.from(new Set(allBests.map(b => b.carType))).sort();

  const filtered = allBests.filter(b => {
    if (filterTrack !== 'All' && b.trackCourse !== filterTrack) return false;
    if (filterCar !== 'All' && b.carType !== filterCar) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PersonalBest[]>();
    for (const b of filtered) {
      const arr = map.get(b.trackCourse) ?? [];
      arr.push(b);
      map.set(b.trackCourse, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-[10px] uppercase tracking-wider">Track:</label>
          <SearchableSelect value={filterTrack} options={[{ value: 'All', label: 'All Tracks' }, ...tracks.map(t => ({ value: t, label: t }))]} onChange={setFilterTrack} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-racing-muted text-[10px] uppercase tracking-wider">Car:</label>
          <SearchableSelect value={filterCar} options={[{ value: 'All', label: 'All Cars' }, ...cars.map(c => ({ value: c, label: c }))]} onChange={setFilterCar} />
        </div>
        <FilterButtonGroup
          options={[{ value: 'car', label: 'Per Car' }, { value: 'session', label: 'Per Session' }, { value: 'all', label: 'All Laps' }]}
          value={lapMode}
          onChange={setLapMode}
        />
        <button onClick={() => setShowTheoretical(!showTheoretical)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
            ${showTheoretical ? 'bg-racing-purple/15 text-racing-purple border border-racing-purple/25' : 'bg-racing-card border border-racing-border text-racing-muted hover:text-racing-text'}`}>
          <Zap className="w-3 h-3" /> Theoretical Best
        </button>
      </div>

      {Array.from(grouped.entries()).map(([track, bests]) => {
        // Build theoretical best entries as PersonalBest objects so they sort with real laps
        const theoreticalBests: PersonalBest[] = [];
        if (showTheoretical) {
          const carTypes = Array.from(new Set(bests.map(b => b.carType)));
          for (const carType of carTypes) {
            const tb = getTheoreticalBest(files, driverNames, track, carType);
            if (!tb.total) continue;
            const ref = bests.find(b => b.carType === carType);
            // Skip if theoretical is not faster than the actual best lap
            if (ref && tb.total >= ref.lapTime) continue;
            theoreticalBests.push({
              lapTime: tb.total,
              sector1: tb.s1 ?? null,
              sector2: tb.s2 ?? null,
              sector3: tb.s3 ?? null,
              topSpeed: 0,
              trackVenue: ref?.trackVenue ?? '',
              trackCourse: track,
              carType: `${carType} (theoretical)`,
              carClass: ref?.carClass ?? 'Unknown',
              sessionType: 'Practice',
              sessionIndex: -1,
              date: '',
              fileName: '',
              lapNumber: 0,
              driverName: ref?.driverName ?? '',
            });
          }
        }

        const allEntries = [...bests, ...theoreticalBests];
        const defaultSorted = allEntries.sort((a, b) => a.lapTime - b.lapTime);
        let bestS1 = Infinity, bestS2 = Infinity, bestS3 = Infinity;
        for (const b of defaultSorted) {
          if (b.sector1 && b.sector1 < bestS1) bestS1 = b.sector1;
          if (b.sector2 && b.sector2 < bestS2) bestS2 = b.sector2;
          if (b.sector3 && b.sector3 < bestS3) bestS3 = b.sector3;
        }
        const fastestLap = defaultSorted[0]?.lapTime ?? Infinity;
        const isTheoretical = (r: PersonalBest) => r.carType.endsWith('(theoretical)');

        const columns: Column<PersonalBest>[] = [
          { key: 'pos', label: '#', width: '40px',
            sortValue: r => r.lapTime,
            render: (r, i) => isTheoretical(r) ? <Zap className="w-3 h-3 text-racing-purple" /> : i === 0 ? <Trophy className="w-4 h-4 text-racing-gold" /> : i === 1 ? <Trophy className="w-4 h-4 text-racing-silver" /> : i === 2 ? <Trophy className="w-4 h-4 text-racing-bronze" /> : <span className="text-racing-muted/40 font-mono text-xs">{i + 1}</span> },
          { key: 'car', label: 'Car', width: '22%', sortValue: r => r.carType,
            render: r => <span className={isTheoretical(r) ? 'text-racing-purple/80 text-xs' : 'text-white text-xs'}>{r.carType}</span> },
          { key: 'class', label: 'Class', width: '65px', sortValue: r => r.carClass,
            render: r => <ClassBadge carClass={r.carClass} /> },
          { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '10%',
            sortValue: r => r.lapTime,
            render: r => <span className={`font-bold ${isTheoretical(r) ? 'text-racing-purple glow-purple' : r.lapTime === fastestLap ? 'text-racing-gold' : 'text-white'}`}>{formatLapTime(r.lapTime)}</span> },
          { key: 's1', label: 'S1', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector1,
            render: r => <span className={isTheoretical(r) ? 'text-racing-purple/70' : r.sector1 !== null && r.sector1 <= bestS1 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector1)}</span> },
          { key: 's2', label: 'S2', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector2,
            render: r => <span className={isTheoretical(r) ? 'text-racing-purple/70' : r.sector2 !== null && r.sector2 <= bestS2 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector2)}</span> },
          { key: 's3', label: 'S3', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector3,
            render: r => <span className={isTheoretical(r) ? 'text-racing-purple/70' : r.sector3 !== null && r.sector3 <= bestS3 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector3)}</span> },
          { key: 'speed', label: 'Top Speed', align: 'right', mono: true, width: '9%',
            sortValue: r => r.topSpeed,
            render: r => isTheoretical(r) ? <span className="text-racing-muted/40">&mdash;</span> : <span className="text-white/70">{formatSpeed(r.topSpeed)}</span> },
          { key: 'session', label: 'Session', width: '10%',
            sortValue: r => r.sessionType,
            render: r => isTheoretical(r) ? <span className="text-racing-muted/40 text-xs">&mdash;</span> : onNavigate
              ? <SessionLink fileName={r.fileName} sessionIndex={r.sessionIndex} onNavigate={onNavigate}>{r.sessionType} &mdash; L{r.lapNumber}</SessionLink>
              : <span className="text-racing-muted text-xs">{r.sessionType} &mdash; L{r.lapNumber}</span> },
          { key: 'date', label: 'Date', width: '12%',
            sortValue: r => r.date,
            render: r => isTheoretical(r) ? <span className="text-racing-muted/40 text-xs">&mdash;</span> : <span className="text-racing-muted/60 text-xs">{r.date}</span> },
        ];

        return (
          <div key={track} className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={track.toUpperCase()}>
              <span className="ml-auto" />
              <ExportButton columns={columns} data={defaultSorted} filename={`lmu-personal-bests-${track.toLowerCase().replace(/\s+/g, '-')}`} />
            </DataCardHeader>
            <SortableTable
              columns={columns}
              data={defaultSorted}
              rowKey={(r, i) => `${r.carType}-${r.fileName}-${r.lapNumber}-${i}`}
              rowClass={r => isTheoretical(r) ? 'bg-racing-purple/[0.04]' : r.lapTime === fastestLap ? 'bg-racing-gold/[0.03]' : ''}
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
