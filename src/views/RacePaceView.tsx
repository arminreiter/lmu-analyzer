import { useState, useMemo, useEffect, memo } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { SearchableSelect } from '../components/SearchableSelect';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, getPersonalBests, formatDelta } from '../lib/analytics';
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
import type { RaceFile, PersonalBest } from '../lib/types';

interface RacePaceViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const RacePaceView = memo(function RacePaceView({ files, driverNames, onNavigate }: RacePaceViewProps) {
  const [benchmarks, setBenchmarks] = useState<PaceBenchmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>('All');
  const [selectedCar, setSelectedCar] = useState<string>('All');

  useEffect(() => {
    let cancelled = false;
    fetchBenchmarks()
      .then(data => { if (!cancelled) setBenchmarks(data); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const loading = benchmarks === null && error === null;

  const bests = useMemo(() => getPersonalBests(files, driverNames), [files, driverNames]);

  // Build fileName → trackCourse lookup from files
  const courseByFile = useMemo(() => {
    const map = new Map<string, { course: string; venue: string }>();
    for (const f of files) map.set(f.fileName, { course: f.trackCourse, venue: f.trackVenue });
    return map;
  }, [files]);

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
      const fileInfo = courseByFile.get(best.fileName);
      const mappedTrack = mapTrackName(fileInfo?.course ?? best.trackVenue, fileInfo?.venue ?? best.trackVenue);
      if (!mappedTrack) continue;
      const benchmark = benchmarks.find(b => b.track === mappedTrack && b.carClass === best.carClass);
      if (!benchmark) continue;
      const { rating, delta, percent } = rateLapTime(best.lapTime, benchmark);
      results.push({ best, benchmark, rating, delta, percent, mappedTrack });
    }

    return results;
  }, [bests, benchmarks, courseByFile]);

  // Filter options
  const tracks = useMemo(() => {
    const set = new Set(comparisons.map(c => c.best.trackVenue));
    return [...set].sort();
  }, [comparisons]);

  const cars = useMemo(() => {
    let items = comparisons;
    if (selectedTrack !== 'All') items = items.filter(c => c.best.trackVenue === selectedTrack);
    const set = new Set(items.map(c => c.best.carType));
    return [...set].sort();
  }, [comparisons, selectedTrack]);

  const filtered = useMemo(() => {
    let items = comparisons;
    if (selectedTrack !== 'All') items = items.filter(c => c.best.trackVenue === selectedTrack);
    if (selectedCar !== 'All') items = items.filter(c => c.best.carType === selectedCar);
    return items.sort((a, b) => a.percent - b.percent);
  }, [comparisons, selectedTrack, selectedCar]);

  // Group by track
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const arr = map.get(item.best.trackVenue) ?? [];
      arr.push(item);
      map.set(item.best.trackVenue, arr);
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
    { key: 'car', label: 'Car', width: '16%',
      sortValue: r => r.best.carType,
      render: r => <span className="text-white text-xs">{r.best.carType}</span> },
    { key: 'class', label: 'Class', width: '60px',
      sortValue: r => r.best.carClass,
      render: r => <ClassBadge carClass={r.best.carClass} /> },
    { key: 'lapTime', label: 'Your Best', align: 'right', mono: true, width: '9%',
      sortValue: r => r.best.lapTime,
      render: r => <span className="text-white font-bold">{formatLapTime(r.best.lapTime)}</span> },
    { key: 'rating', label: 'Rating', width: '10%',
      sortValue: r => {
        const order: Record<PaceRating, number> = { 'Above Alien': 0, 'Alien': 1, 'Competitive': 2, 'Good': 3, 'Midpack': 4, 'Tail-ender': 5, 'Offline': 6 };
        return order[r.rating];
      },
      render: r => (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getRatingColor(r.rating)} ${getRatingBgColor(r.rating)}`}>
          {r.rating}
        </span>
      ),
    },
    { key: 'target', label: 'Next Target', align: 'right', mono: true, width: '9%',
      sortValue: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        return t ? t.time : 0;
      },
      render: r => {
        const t = getNextTarget(r.best.lapTime, r.rating, r.benchmark);
        if (!t) return <span className="text-racing-purple text-xs">--</span>;
        return (
          <span className="text-racing-muted">
            {formatLapTime(t.time)}
            <span className="text-racing-muted/50 text-[10px] ml-1">({t.label.replace('Above ', '')})</span>
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
        ? <button onClick={(e) => { e.stopPropagation(); onNavigate('session', `${r.best.fileName}::${r.best.sessionIndex}`); }} className="text-racing-muted text-xs hover:text-racing-red transition-colors cursor-pointer underline decoration-racing-muted/30 hover:decoration-racing-red">{r.best.sessionType} L{r.best.lapNumber}</button>
        : <span className="text-racing-muted text-xs">{r.best.sessionType} L{r.best.lapNumber}</span> },
    { key: 'date', label: 'Date', width: '10%',
      sortValue: r => r.best.date,
      render: r => <span className="text-racing-muted/60 text-xs">{r.best.date}</span> },
  ];

  return (
    <div className="space-y-5">
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

      {/* Pace reference legend */}
      <div className="data-card carbon-fiber px-5 py-3">
        <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-wider">
          <span className="text-racing-muted font-medium">Pace Tiers:</span>
          {(['Above Alien', 'Alien', 'Competitive', 'Good', 'Midpack', 'Tail-ender', 'Offline'] as PaceRating[]).map(r => (
            <span key={r} className={`${getRatingColor(r)} font-semibold`}>{r}</span>
          ))}
        </div>
      </div>

      {/* Grouped tables */}
      {Array.from(grouped.entries()).map(([track, items]) => {
        const sorted = [...items].sort((a, b) => a.best.lapTime - b.best.lapTime);

        // Best rating achieved at this track
        const ratingOrder: Record<PaceRating, number> = { 'Above Alien': 0, 'Alien': 1, 'Competitive': 2, 'Good': 3, 'Midpack': 4, 'Tail-ender': 5, 'Offline': 6 };
        const bestItem = sorted.reduce((best, cur) => ratingOrder[cur.rating] < ratingOrder[best.rating] ? cur : best, sorted[0]);
        const classes = [...new Set(sorted.map(r => r.best.carClass))];

        return (
          <div key={track} className="data-card carbon-fiber overflow-hidden">
            <div className="px-5 py-3 border-b border-racing-border flex items-center justify-between checkered">
              <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">{track.toUpperCase()}</h3>
              <div className="flex items-center gap-3 text-[10px]">
                {classes.map(c => <ClassBadge key={c} carClass={c} />)}
                <span className={`inline-flex px-2 py-0.5 rounded font-semibold uppercase tracking-wider border ${getRatingColor(bestItem.rating)} ${getRatingBgColor(bestItem.rating)}`}>
                  Best: {bestItem.rating}
                </span>
              </div>
            </div>
            <SortableTable
              columns={columns}
              data={sorted}
              rowKey={r => `${r.best.carType}-${r.best.fileName}-${r.best.lapNumber}`}
              rowClass={r => {
                if (r.rating === 'Above Alien') return 'bg-racing-purple/[0.04]';
                if (r.rating === 'Alien') return 'bg-racing-green/[0.03]';
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

      {/* Credit attribution */}
      <div className="data-card carbon-fiber px-5 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-racing-muted text-xs">
              Pace benchmarks by{' '}
              <span className="text-white font-medium">ohne_speed</span>
            </p>
            <p className="text-racing-muted/60 text-[10px] mt-0.5">
              Community-sourced race pace reference data for Le Mans Ultimate
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://www.youtube.com/@ohne_speed"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                bg-white/5 border border-racing-border text-racing-text
                hover:bg-white/10 hover:text-white hover:border-racing-muted/50"
            >
              <ExternalLink className="w-3 h-3" />
              YouTube
            </a>
            <a
              href="https://discord.com/invite/dFAqhnuSXH"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                bg-white/5 border border-racing-border text-racing-text
                hover:bg-white/10 hover:text-white hover:border-racing-muted/50"
            >
              <ExternalLink className="w-3 h-3" />
              Discord
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});
