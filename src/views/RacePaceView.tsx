import { useState, useMemo, useEffect, memo } from 'react';
import { Loader2, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { SearchableSelect } from '../components/SearchableSelect';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { SessionLink } from '../components/SessionLink';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { CLASS_SPEED_ORDER } from '../lib/analytics';
import { formatLapTime, formatDelta } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
import {
  fetchBenchmarks,
  mapTrackName,
  rateLapTime,
  getNextTarget,
  getRatingColor,
  getRatingBgColor,
  type PaceBenchmark,
  type PaceRating,
} from '../lib/racepace';
import type { RaceFile, PersonalBest, CarClass } from '../lib/types';

interface RacePaceViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
  onViewChange?: (view: string) => void;
}

interface ClassAggregate { carClass: CarClass; avgPercent: number; trackCount: number; avgRating: PaceRating }
interface RaceClassAggregate extends ClassAggregate { totalLaps: number }

const ratingFromPercent = (pct: number): PaceRating => {
  if (pct <= 100) return 'Alien';
  if (pct <= 101) return 'Competitive';
  if (pct <= 102) return 'Good';
  if (pct <= 104) return 'Midpack';
  if (pct <= 106) return 'Tail-ender';
  return 'Offline';
};

/** Group items by class, keep best per track+class, return per-class averages */
function aggregateByClass<T>(
  items: T[],
  getKey: (item: T) => { carClass: CarClass; mappedTrack: string },
  getPercent: (item: T) => number,
): ClassAggregate[] {
  const bestByTrackClass = new Map<string, T>();
  for (const item of items) {
    const { carClass, mappedTrack } = getKey(item);
    const key = `${carClass}::${mappedTrack}`;
    const existing = bestByTrackClass.get(key);
    if (!existing || getPercent(item) < getPercent(existing)) {
      bestByTrackClass.set(key, item);
    }
  }

  const classMap = new Map<CarClass, T[]>();
  for (const entry of bestByTrackClass.values()) {
    const cls = getKey(entry).carClass;
    const arr = classMap.get(cls) ?? [];
    arr.push(entry);
    classMap.set(cls, arr);
  }

  const results: ClassAggregate[] = [];
  for (const [carClass, entries] of classMap) {
    const avg = entries.reduce((sum, e) => sum + getPercent(e), 0) / entries.length;
    results.push({ carClass, avgPercent: avg, trackCount: entries.length, avgRating: ratingFromPercent(avg) });
  }
  return results.sort((a, b) => a.avgPercent - b.avgPercent);
}

export const RacePaceView = memo(function RacePaceView({ files, driverNames, onNavigate, onViewChange }: RacePaceViewProps) {
  const [benchmarks, setBenchmarks] = useState<PaceBenchmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>('All');
  const [selectedCar, setSelectedCar] = useState<string>('All');

  // Aggregate filter state
  const [aggFiltersOpen, setAggFiltersOpen] = useState(false);
  const [aggRemoveOutliers, setAggRemoveOutliers] = useState(true);
  const [aggExcludedCars, setAggExcludedCars] = useState<Set<string>>(new Set());
  const [aggExcludedTracks, setAggExcludedTracks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchBenchmarks()
      .then(data => { if (!cancelled) setBenchmarks(data); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const loading = benchmarks === null && error === null;

  const { personalBests: bests } = useDataIndex();

  // Build comparison data: match each personal best to a benchmark
  const comparisons = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) return [];
    const results: Array<{
      best: PersonalBest;
      benchmark: PaceBenchmark;
      rating: PaceRating;
      delta: number;
      percent: number;
      mappedTrack: string;
    }> = [];

    for (const best of bests) {
      const mappedTrack = mapTrackName(best.trackCourse, best.trackVenue);
      if (!mappedTrack) continue;
      const benchmark = benchmarks.find(b => b.track === mappedTrack && b.carClass === best.carClass);
      if (!benchmark) continue;
      const { rating, delta, percent } = rateLapTime(best.lapTime, benchmark);
      results.push({ best, benchmark, rating, delta, percent, mappedTrack });
    }

    return results;
  }, [bests, benchmarks]);

  // Compute race pace: average race lap time per track/class
  const racePaceComparisons = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) return [];
    const results: Array<{
      carClass: CarClass;
      carType: string;
      trackCourse: string;
      mappedTrack: string;
      avgLapTime: number;
      lapCount: number;
      benchmark: PaceBenchmark;
      percent: number;
      rating: PaceRating;
    }> = [];

    // Group race laps by track+class+car
    const raceGroups = new Map<string, { laps: number[]; benchmark: PaceBenchmark; carClass: CarClass; carType: string; trackCourse: string; mappedTrack: string }>();

    for (const file of files) {
      for (const session of file.sessions) {
        if (session.type !== 'Race') continue;
        for (const driver of session.drivers) {
          if (!driverNames.some(n => n === driver.name)) continue;
          const mappedTrack = mapTrackName(file.trackCourse, file.trackVenue);
          if (!mappedTrack) continue;
          const benchmark = benchmarks.find(b => b.track === mappedTrack && b.carClass === driver.carClass);
          if (!benchmark) continue;

          const key = `${driver.carClass}::${mappedTrack}`;
          if (!raceGroups.has(key)) {
            raceGroups.set(key, { laps: [], benchmark, carClass: driver.carClass, carType: driver.carType, trackCourse: file.trackCourse, mappedTrack });
          }
          const group = raceGroups.get(key)!;

          for (const lap of driver.laps) {
            if (!lap.lapTime || lap.lapTime <= 0) continue;
            if (lap.isPit) continue;
            if (lap.num <= 1) continue;
            group.laps.push(lap.lapTime);
          }
        }
      }
    }

    for (const [, group] of raceGroups) {
      if (group.laps.length < 3) continue;
      const sorted = [...group.laps].sort((a, b) => a - b);

      let lapsToAvg: number[];
      if (aggRemoveOutliers) {
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        lapsToAvg = sorted.filter(t => t >= lower && t <= upper);
      } else {
        lapsToAvg = sorted;
      }
      if (lapsToAvg.length === 0) continue;

      const avg = lapsToAvg.reduce((a, b) => a + b, 0) / lapsToAvg.length;
      const { rating, percent } = rateLapTime(avg, group.benchmark);
      results.push({
        carClass: group.carClass,
        carType: group.carType,
        trackCourse: group.trackCourse,
        mappedTrack: group.mappedTrack,
        avgLapTime: avg,
        lapCount: lapsToAvg.length,
        benchmark: group.benchmark,
        percent,
        rating,
      });
    }

    return results;
  }, [files, driverNames, benchmarks, aggRemoveOutliers]);

  // Available cars and tracks for aggregate filters
  const aggAvailableCars = useMemo(() => {
    const set = new Set<string>();
    for (const c of comparisons) set.add(c.best.carType);
    for (const c of racePaceComparisons) set.add(c.carType);
    return [...set].sort();
  }, [comparisons, racePaceComparisons]);

  const aggAvailableTracks = useMemo(() => {
    const set = new Set<string>();
    for (const c of comparisons) set.add(c.best.trackCourse);
    for (const c of racePaceComparisons) set.add(c.trackCourse);
    return [...set].sort();
  }, [comparisons, racePaceComparisons]);


  // Aggregate pace % by car class — best lap per track only
  const classAggregates = useMemo(() => {
    const filtered = comparisons.filter(c =>
      !aggExcludedCars.has(c.best.carType) && !aggExcludedTracks.has(c.best.trackCourse)
    );
    return aggregateByClass(filtered, c => ({ carClass: c.best.carClass as CarClass, mappedTrack: c.mappedTrack }), c => c.percent);
  }, [comparisons, aggExcludedCars, aggExcludedTracks]);

  // Aggregate race pace % by car class — one entry per track
  const racePaceAggregates = useMemo((): RaceClassAggregate[] => {
    const filtered = racePaceComparisons.filter(c =>
      !aggExcludedCars.has(c.carType) && !aggExcludedTracks.has(c.trackCourse)
    );
    const base = aggregateByClass(filtered, c => ({ carClass: c.carClass as CarClass, mappedTrack: c.mappedTrack }), c => c.percent);
    // Add totalLaps per class from the filtered data
    const lapsByClass = new Map<string, number>();
    for (const c of filtered) {
      lapsByClass.set(c.carClass, (lapsByClass.get(c.carClass) ?? 0) + c.lapCount);
    }
    return base.map(a => ({ ...a, totalLaps: lapsByClass.get(a.carClass) ?? 0 }));
  }, [racePaceComparisons, aggExcludedCars, aggExcludedTracks]);

  // Filter options
  const tracks = useMemo(() => {
    const set = new Set(comparisons.map(c => c.best.trackCourse));
    return [...set].sort();
  }, [comparisons]);

  const cars = useMemo(() => {
    let items = comparisons;
    if (selectedTrack !== 'All') items = items.filter(c => c.best.trackCourse === selectedTrack);
    const set = new Set(items.map(c => c.best.carType));
    return [...set].sort();
  }, [comparisons, selectedTrack]);

  const filtered = useMemo(() => {
    let items = comparisons;
    if (selectedTrack !== 'All') items = items.filter(c => c.best.trackCourse === selectedTrack);
    if (selectedCar !== 'All') items = items.filter(c => c.best.carType === selectedCar);
    return items.sort((a, b) => a.percent - b.percent);
  }, [comparisons, selectedTrack, selectedCar]);

  // Group by track
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const arr = map.get(item.best.trackCourse) ?? [];
      arr.push(item);
      map.set(item.best.trackCourse, arr);
    }
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-racing-muted gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading pace benchmarks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-racing-red text-sm">Failed to load pace data: {error}</p>
        <p className="text-racing-muted text-xs mt-2">Check your internet connection and try again.</p>
      </div>
    );
  }

  type ComparisonRow = typeof filtered[number];

  const columns: Column<ComparisonRow>[] = [
    { key: 'car', label: 'Car', width: '14%', cellClass: 'pl-4 pr-1',
      sortValue: r => r.best.carType,
      render: r => <span className="text-white text-xs">{r.best.carType}</span> },
    { key: 'class', label: 'Class', width: '9%', cellClass: 'px-0',
      sortValue: r => r.best.carClass,
      render: r => <ClassBadge carClass={r.best.carClass} /> },
    { key: 'lapTime', label: 'Your Best', align: 'right', mono: true, width: '8%',
      sortValue: r => r.best.lapTime,
      render: r => <span className="text-white font-bold">{formatLapTime(r.best.lapTime)}</span> },
    { key: 'rating', label: 'Rating', width: '10%',
      sortValue: r => {
        const order: Record<PaceRating, number> = { 'Alien': 0, 'Competitive': 1, 'Good': 2, 'Midpack': 3, 'Tail-ender': 4, 'Offline': 5 };
        return order[r.rating];
      },
      render: r => (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getRatingColor(r.rating)} ${getRatingBgColor(r.rating)}`}>
          {r.rating}
        </span>
      ),
    },
    { key: 'target', label: 'Next Target', width: '13%',
      sortValue: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        return t ? t.time : 0;
      },
      render: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        if (!t) return <span className="text-racing-purple text-xs">--</span>;
        return (
          <span className="inline-flex items-baseline gap-1">
            <span className="text-racing-muted font-mono">{formatLapTime(t.time)}</span>
            <span className="text-racing-muted/50 text-[10px]">({t.label.replace('Above ', '')})</span>
          </span>
        );
      },
    },
    { key: 'gap', label: 'Gap', align: 'right', mono: true, width: '7%',
      sortValue: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        return t ? t.gap : -1;
      },
      render: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        if (!t) return <span className="text-racing-purple text-xs">--</span>;
        return <span className="text-racing-orange font-medium">{formatDelta(t.gap)}</span>;
      },
    },
    { key: 'percent', label: '%', align: 'right', mono: true, width: '5%',
      sortValue: r => r.percent,
      render: r => <span className="text-racing-muted">{r.percent.toFixed(1)}%</span> },
    { key: 'alien', label: 'Alien', align: 'right', mono: true, width: '9%',
      sortValue: r => r.benchmark.racePace.alien,
      render: r => {
        const delta = r.best.lapTime - r.benchmark.racePace.alien;
        const color = delta <= 0 ? 'text-racing-green' : 'text-racing-muted';
        return (
          <span className={color}>
            {formatLapTime(r.benchmark.racePace.alien)}
            {delta <= 0 && <span className="text-racing-green text-[10px] ml-1">{formatDelta(delta)}</span>}
          </span>
        );
      },
    },
    { key: 'session', label: 'Session', width: '9%',
      sortValue: r => r.best.sessionType,
      render: r => onNavigate
        ? <SessionLink fileName={r.best.fileName} sessionIndex={r.best.sessionIndex} driverName={r.best.driverName} onNavigate={onNavigate}>{r.best.sessionType} L{r.best.lapNumber}</SessionLink>
        : <span className="text-racing-muted text-xs">{r.best.sessionType} L{r.best.lapNumber}</span> },
    { key: 'date', label: 'Date', width: '13%',
      sortValue: r => r.best.date,
      render: r => <span className="text-racing-muted/60 text-xs">{r.best.date}</span> },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      {onViewChange && (
        <div className="flex items-center gap-0 border-b border-racing-border/30">
          {[{ id: 'benchmarks', label: 'Overview' }, { id: 'trackmode', label: 'Per Track' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`px-5 py-2 text-xs font-medium tracking-[0.08em] uppercase whitespace-nowrap transition-all cursor-pointer border-b-2 -mb-px
                ${tab.id === 'benchmarks'
                  ? 'border-racing-red text-white'
                  : 'border-transparent text-racing-muted hover:text-racing-text'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {/* Your Pace summary */}
      {(classAggregates.length > 0 || racePaceAggregates.length > 0) && (
        <div className="data-card carbon-fiber overflow-hidden">
          <DataCardHeader title="YOUR OVERALL PACE">
            <button
              onClick={() => setAggFiltersOpen(o => !o)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${aggFiltersOpen ? 'bg-racing-red/20 text-racing-red' : 'text-racing-muted hover:text-white hover:bg-white/5'}`}
              title="Filter aggregate data"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </DataCardHeader>
          {aggFiltersOpen && (
            <div className="px-5 py-3 border-b border-racing-border/30 bg-racing-dark/30">
              <div className="space-y-2.5 text-[11px]">
                {/* Settings */}
                <div className="flex items-start gap-2">
                  <span className="text-racing-muted/60 text-[10px] uppercase tracking-wider font-medium pt-0.5 shrink-0 w-12">Settings:</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aggRemoveOutliers}
                    onChange={e => setAggRemoveOutliers(e.target.checked)}
                    className="accent-racing-red w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-racing-muted">Remove outliers</span>
                  <span className="text-racing-muted/40 text-[9px]">(race pace)</span>
                </label>
                </div>

                {/* Track filter */}
                <div className="flex items-start gap-2">
                  <span className="text-racing-muted/60 text-[10px] uppercase tracking-wider font-medium pt-0.5 shrink-0 w-12">Tracks:</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {aggAvailableTracks.map(t => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!aggExcludedTracks.has(t)}
                          onChange={() => setAggExcludedTracks(prev => {
                            const next = new Set(prev);
                            if (next.has(t)) next.delete(t); else next.add(t);
                            return next;
                          })}
                          className="accent-racing-red w-3 h-3 cursor-pointer"
                        />
                        <span className="text-racing-muted">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Car filter */}
                <div className="flex items-start gap-2">
                  <span className="text-racing-muted/60 text-[10px] uppercase tracking-wider font-medium pt-0.5 shrink-0 w-12">Cars:</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {aggAvailableCars.map(c => (
                      <label key={c} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!aggExcludedCars.has(c)}
                          onChange={() => setAggExcludedCars(prev => {
                            const next = new Set(prev);
                            if (next.has(c)) next.delete(c); else next.add(c);
                            return next;
                          })}
                          className="accent-racing-red w-3 h-3 cursor-pointer"
                        />
                        <span className="text-racing-muted">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr className="text-racing-muted text-[10px] uppercase tracking-wider border-b border-racing-border/30">
                <th className="text-left font-medium pl-4 pr-1 py-2">Type</th>
                <th className="text-left font-medium px-0 py-2">Class</th>
                <th className="text-right font-medium px-4 py-2">Pace</th>
                <th className="text-left font-medium px-4 py-2">Rating</th>
                <th className="text-left font-medium px-4 py-2">Based On</th>
                <th colSpan={5} />
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Collect all classes from both aggregates, ordered by speed
                const classSet = new Set([
                  ...classAggregates.map(a => a.carClass),
                  ...racePaceAggregates.map(a => a.carClass),
                ]);
                const allClasses = CLASS_SPEED_ORDER.filter(c => classSet.has(c));

                return allClasses.map(cls => {
                  const best = classAggregates.find(a => a.carClass === cls);
                  const race = racePaceAggregates.find(a => a.carClass === cls);
                  return [
                    best && (
                      <tr key={`best-${cls}`} className="border-b border-racing-border/10">
                        <td className="text-racing-muted text-[10px] uppercase tracking-wider font-medium pl-4 pr-1 py-2">Based on Best Laps</td>
                        <td className="px-0 py-2"><ClassBadge carClass={best.carClass} /></td>
                        <td className="text-right px-4 py-2"><span className="text-white font-mono font-bold">{best.avgPercent.toFixed(1)}%</span></td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${getRatingColor(best.avgRating)} ${getRatingBgColor(best.avgRating)}`}>
                            {best.avgRating}
                          </span>
                        </td>
                        <td className="text-racing-muted/50 text-[10px] px-4 py-2">{best.trackCount} {best.trackCount === 1 ? 'track' : 'tracks'}</td>
                        <td colSpan={5} />
                      </tr>
                    ),
                    race && (
                      <tr key={`race-${cls}`} className="border-b border-racing-border/10">
                        <td className="text-racing-muted text-[10px] uppercase tracking-wider font-medium pl-4 pr-1 py-2">Based on Race Pace</td>
                        <td className="px-0 py-2"><ClassBadge carClass={race.carClass} /></td>
                        <td className="text-right px-4 py-2"><span className="text-white font-mono font-bold">{race.avgPercent.toFixed(1)}%</span></td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${getRatingColor(race.avgRating)} ${getRatingBgColor(race.avgRating)}`}>
                            {race.avgRating}
                          </span>
                        </td>
                        <td className="text-racing-muted/50 text-[10px] px-4 py-2">{race.trackCount} {race.trackCount === 1 ? 'track' : 'tracks'}, {race.totalLaps} laps</td>
                        <td colSpan={5} />
                      </tr>
                    ),
                  ];
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters + credit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-racing-muted text-[10px] uppercase tracking-wider">Track:</label>
            <SearchableSelect
              value={selectedTrack}
              options={[{ value: 'All', label: 'All Tracks' }, ...tracks.map(t => ({ value: t, label: t }))]}
              onChange={v => { setSelectedTrack(v); setSelectedCar('All'); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-racing-muted text-[10px] uppercase tracking-wider">Car:</label>
            <SearchableSelect
              value={selectedCar}
              options={[{ value: 'All', label: 'All Cars' }, ...cars.map(c => ({ value: c, label: c }))]}
              onChange={setSelectedCar}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap items-center gap-2.5 text-[10px] uppercase tracking-wider">
            <span className="text-racing-muted font-medium">Pace Tiers:</span>
            {(['Alien', 'Competitive', 'Good', 'Midpack', 'Tail-ender', 'Offline'] as PaceRating[]).map(r => (
              <span key={r} className={`${getRatingColor(r)} font-semibold`}>{r}</span>
            ))}
          </div>
          <span className="text-racing-border">|</span>
          <div className="flex items-center gap-1.5 text-[10px] text-racing-muted/60">
            <span>Data by</span>
            <a
              href="https://www.youtube.com/@ohne_speed"
              target="_blank"
              rel="noopener noreferrer"
              className="text-racing-muted hover:text-white transition-colors font-medium"
            >ohne_speed</a>
            <span>&middot;</span>
            <a
              href="https://docs.google.com/spreadsheets/d/e/2PACX-1vTN03UvJDm99byA6vQPZHKOCYVvfxLu1zkJAzdaKyROykzEKY2-Xl1rl1q5znZEf36m88dxMKsY2eaO/pubhtml#gid=1766901750"
              target="_blank"
              rel="noopener noreferrer"
              className="text-racing-muted hover:text-white transition-colors flex items-center gap-0.5"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Spreadsheet
            </a>
          </div>
        </div>
      </div>

      {/* Grouped tables */}
      {Array.from(grouped.entries()).map(([track, items]) => {
        const sorted = [...items].sort((a, b) => a.best.lapTime - b.best.lapTime);

        // Best rating achieved at this track
        const ratingOrder: Record<PaceRating, number> = { 'Alien': 0, 'Competitive': 1, 'Good': 2, 'Midpack': 3, 'Tail-ender': 4, 'Offline': 5 };
        const bestItem = sorted.reduce((best, cur) => ratingOrder[cur.rating] < ratingOrder[best.rating] ? cur : best, sorted[0]);
        const classes = [...new Set(sorted.map(r => r.best.carClass))];

        return (
          <div key={track} className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title={track.toUpperCase()}>
              <div className="ml-auto flex items-center gap-3 text-[10px]">
                {classes.map(c => <ClassBadge key={c} carClass={c} />)}
                <span className={`inline-flex px-2 py-0.5 rounded font-semibold uppercase tracking-wider border ${getRatingColor(bestItem.rating)} ${getRatingBgColor(bestItem.rating)}`}>
                  Best: {bestItem.rating}
                </span>
                <ExportButton columns={columns} data={sorted} filename={`lmu-pace-${track.toLowerCase().replace(/\s+/g, '-')}`} />
              </div>
            </DataCardHeader>
            <SortableTable
              columns={columns}
              data={sorted}
              rowKey={r => `${r.best.carType}-${r.best.fileName}-${r.best.lapNumber}`}
              rowClass={r => {
                if (r.rating === 'Alien') return 'bg-racing-purple/[0.04]';
                if (r.rating === 'Competitive') return 'bg-racing-green/[0.03]';
                return '';
              }}
            />
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-racing-muted">
          <p>No matching pace data found.</p>
          <p className="text-xs mt-1">Pace benchmarks are available for tracks in the ohne_speed spreadsheet.</p>
        </div>
      )}

      <OhneSpeedCredit />
    </div>
  );
});
