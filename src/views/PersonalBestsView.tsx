import { useState, useMemo, useCallback, memo } from 'react';
import { Trophy, Zap } from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SessionLink } from '../components/SessionLink';
import { SearchableSelect } from '../components/SearchableSelect';
import { trackOption, trackLabel } from '../lib/racepace';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { getTheoreticalBest, hasMixedSetups, matchesSetup, SETUP_FILTER_OPTIONS, type SetupFilter } from '../lib/analytics';
import { formatLapTime, formatSector, formatSpeed } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
import type { RaceFile, PersonalBest } from '../lib/types';
import { useSessionMenu } from '../lib/sessionMenu';
import { truePace } from '../lib/stints';
import { lapCard } from '../lib/shareCard';
import { TrackLink, CarLink } from '../components/EntityLinks';

type LapMode = 'car' | 'session' | 'all';

// Real laps and theoretical bests share one row shape; rowType discriminates them
type BestRow = PersonalBest & { rowType: 'lap' | 'theoretical' };

interface PersonalBestsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const PersonalBestsView = memo(function PersonalBestsView({ files, driverNames, onNavigate }: PersonalBestsViewProps) {
  const sessionMenu = useSessionMenu();
  const [filterTrack, setFilterTrack] = useState<string>('All');
  const [filterCar, setFilterCar] = useState<string>('All');
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [lapMode, setLapMode] = useState<LapMode>('car');
  const [pickedSetup, setFilterSetup] = useState<SetupFilter>('all');
  const mixedSetups = useMemo(() => hasMixedSetups(files), [files]);
  // The control hides when the data stops having both kinds — so must its effect
  const filterSetup: SetupFilter = mixedSetups ? pickedSetup : 'all';
  const fileByName = useMemo(() => new Map(files.map(f => [f.fileName, f])), [files]);

  const { personalBests: bestPerCar, allSessionBests: bestPerSession, allLaps: everyLap, sectorMins } = useDataIndex();
  const bySetup = useCallback((b: PersonalBest) => {
    const file = fileByName.get(b.fileName);
    return !file || matchesSetup(file, filterSetup);
  }, [fileByName, filterSetup]);
  // Per car under a setup filter: the car's best lap among that setup's laps, not its overall PB
  const bestPerCarInSetup = useMemo(() => {
    if (filterSetup === 'all') return bestPerCar;
    const best = new Map<string, PersonalBest>();
    for (const lap of everyLap) {
      const key = `${lap.trackCourse}|${lap.carType}`;
      if (bySetup(lap) && lap.lapTime < (best.get(key)?.lapTime ?? Infinity)) best.set(key, lap);
    }
    return [...best.values()];
  }, [filterSetup, bestPerCar, everyLap, bySetup]);
  // Valid lap times per track+car (respecting the setup filter), for the True Pace column
  const truePaces = useMemo(() => {
    const times = new Map<string, number[]>();
    for (const lap of everyLap) {
      if (!bySetup(lap)) continue;
      const key = `${lap.trackCourse}|${lap.carType}`;
      const list = times.get(key);
      if (list) list.push(lap.lapTime);
      else times.set(key, [lap.lapTime]);
    }
    return new Map([...times].map(([key, t]) => [key, truePace(t)]));
  }, [everyLap, bySetup]);
  const allBests = lapMode === 'all' ? everyLap : lapMode === 'session' ? bestPerSession : bestPerCarInSetup;
  const tracks = useMemo(() => Array.from(new Set(allBests.map(b => b.trackCourse))).sort(), [allBests]);
  const cars = useMemo(() => Array.from(new Set(allBests.map(b => b.carType))).sort(), [allBests]);

  const filtered = useMemo(() => allBests.filter(b => {
    if (filterTrack !== 'All' && b.trackCourse !== filterTrack) return false;
    if (filterCar !== 'All' && b.carType !== filterCar) return false;
    return bySetup(b);
  }), [allBests, filterTrack, filterCar, bySetup]);

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
          <SearchableSelect value={filterTrack} options={[{ value: 'All', label: 'All Tracks' }, ...tracks.map(trackOption)]} onChange={setFilterTrack} />
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
        {mixedSetups && <FilterButtonGroup options={SETUP_FILTER_OPTIONS} value={filterSetup} onChange={setFilterSetup} />}
        <button onClick={() => setShowTheoretical(!showTheoretical)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
            ${showTheoretical ? 'bg-racing-purple/15 text-racing-purple border border-racing-purple/25' : 'bg-racing-card border border-racing-border text-racing-muted hover:text-racing-text'}`}>
          <Zap className="w-3 h-3" /> Theoretical Best
        </button>
      </div>

      {Array.from(grouped.entries()).map(([track, bests]) => {
        // Build theoretical best entries as rows so they sort with real laps
        const rows: BestRow[] = bests.map(b => ({ ...b, rowType: 'lap' as const }));
        if (showTheoretical) {
          const carTypes = Array.from(new Set(bests.map(b => b.carType)));
          for (const carType of carTypes) {
            const tb = getTheoreticalBest(files, driverNames, track, carType, sectorMins.get(`${track}|${carType}`));
            if (!tb.total) continue;
            const ref = bests.find(b => b.carType === carType);
            // Skip if theoretical is not faster than the actual best lap
            if (ref && tb.total >= ref.lapTime) continue;
            rows.push({
              rowType: 'theoretical',
              lapTime: tb.total,
              sector1: tb.s1 ?? null,
              sector2: tb.s2 ?? null,
              sector3: tb.s3 ?? null,
              topSpeed: 0,
              trackVenue: ref?.trackVenue ?? '',
              trackCourse: track,
              carType,
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

        const defaultSorted = rows.sort((a, b) => a.lapTime - b.lapTime);
        let bestS1 = Infinity, bestS2 = Infinity, bestS3 = Infinity;
        for (const b of defaultSorted) {
          if (b.sector1 && b.sector1 < bestS1) bestS1 = b.sector1;
          if (b.sector2 && b.sector2 < bestS2) bestS2 = b.sector2;
          if (b.sector3 && b.sector3 < bestS3) bestS3 = b.sector3;
        }
        const fastestLap = defaultSorted[0]?.lapTime ?? Infinity;

        const columns: Column<BestRow>[] = [
          { key: 'pos', label: '#', width: '40px',
            sortValue: r => r.lapTime,
            render: (r, i) => r.rowType === 'theoretical' ? <Zap className="w-3 h-3 text-racing-purple" /> : i === 0 ? <Trophy className="w-4 h-4 text-racing-gold" /> : i === 1 ? <Trophy className="w-4 h-4 text-racing-silver" /> : i === 2 ? <Trophy className="w-4 h-4 text-racing-bronze" /> : <span className="text-racing-muted/40 font-mono text-xs">{i + 1}</span> },
          { key: 'car', label: 'Car', width: '22%', sortValue: r => r.carType,
            exportValue: r => r.rowType === 'theoretical' ? `${r.carType} (theoretical)` : r.carType,
            render: r => r.rowType === 'theoretical'
              ? <span className="text-racing-purple/80 text-xs">{r.carType} (theoretical)</span>
              : <CarLink car={r.carType} className="text-white text-xs" /> },
          { key: 'class', label: 'Class', width: '100px', sortValue: r => r.carClass,
            render: r => <ClassBadge carClass={r.carClass} /> },
          { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '10%',
            sortValue: r => r.lapTime,
            render: r => <span className={`font-bold ${r.rowType === 'theoretical' ? 'text-racing-purple glow-purple' : r.lapTime === fastestLap ? 'text-racing-gold' : 'text-white'}`}>{formatLapTime(r.lapTime)}</span> },
          { key: 'truePace', label: 'True Pace', align: 'right', mono: true, width: '9%',
            sortValue: r => truePaces.get(`${r.trackCourse}|${r.carType}`) ?? null,
            exportValue: r => r.rowType === 'theoretical' ? null : formatLapTime(truePaces.get(`${r.trackCourse}|${r.carType}`) ?? null),
            render: r => r.rowType === 'theoretical' ? <span className="text-racing-muted/40">&mdash;</span>
              : <span className="text-racing-text" title="Median of your 5 fastest laps in this car here — the pace you can repeat">{formatLapTime(truePaces.get(`${r.trackCourse}|${r.carType}`) ?? null)}</span> },
          { key: 's1', label: 'S1', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector1,
            render: r => <span className={r.rowType === 'theoretical' ? 'text-racing-purple/70' : r.sector1 !== null && r.sector1 <= bestS1 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector1)}</span> },
          { key: 's2', label: 'S2', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector2,
            render: r => <span className={r.rowType === 'theoretical' ? 'text-racing-purple/70' : r.sector2 !== null && r.sector2 <= bestS2 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector2)}</span> },
          { key: 's3', label: 'S3', align: 'right', mono: true, width: '8%',
            sortValue: r => r.sector3,
            render: r => <span className={r.rowType === 'theoretical' ? 'text-racing-purple/70' : r.sector3 !== null && r.sector3 <= bestS3 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector3)}</span> },
          { key: 'speed', label: 'Top Speed', align: 'right', mono: true, width: '9%',
            sortValue: r => r.topSpeed,
            render: r => r.rowType === 'theoretical' ? <span className="text-racing-muted/40">&mdash;</span> : <span className="text-white/70">{formatSpeed(r.topSpeed)}</span> },
          { key: 'session', label: 'Session', width: '10%',
            sortValue: r => r.sessionType,
            exportValue: r => r.rowType === 'theoretical' ? 'Theoretical' : r.sessionType,
            render: r => r.rowType === 'theoretical' ? <span className="text-racing-muted/40 text-xs">&mdash;</span> : onNavigate
              ? <SessionLink fileName={r.fileName} sessionIndex={r.sessionIndex} driverName={r.driverName} onNavigate={onNavigate}>{r.sessionType} &mdash; L{r.lapNumber}</SessionLink>
              : <span className="text-racing-muted text-xs">{r.sessionType} &mdash; L{r.lapNumber}</span> },
          { key: 'date', label: 'Date', width: '12%',
            sortValue: r => r.date,
            render: r => r.rowType === 'theoretical' ? <span className="text-racing-muted/40 text-xs">&mdash;</span> : <span className="text-racing-muted/60 text-xs">{r.date}</span> },
        ];

        return (
          <div key={track} className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={<TrackLink track={track}>{trackLabel(track).toUpperCase()}</TrackLink>}>
              <span className="ml-auto" />
              <ExportButton columns={columns} data={defaultSorted} filename={`lmu-personal-bests-${track}`} />
            </DataCardHeader>
            <SortableTable
              columns={columns}
              data={defaultSorted}
              rowKey={(r, i) => `${r.rowType}-${r.carType}-${r.fileName}-${r.lapNumber}-${i}`}
              rowClass={r => r.rowType === 'theoretical' ? 'bg-racing-purple/[0.04]' : r.lapTime === fastestLap ? 'bg-racing-gold/[0.03]' : ''}
              rowMenu={r => r.rowType === 'theoretical' ? [] : sessionMenu({ ...r, card: () => lapCard(r, truePaces.get(`${r.trackCourse}|${r.carType}`)) })}
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
