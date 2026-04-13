import { useState, useMemo, useEffect, memo } from 'react';
import { Loader2, Gauge, Zap } from 'lucide-react';
import { SearchableSelect } from '../components/SearchableSelect';
import { OhneSpeedCredit } from '../components/OhneSpeedCredit';
import { ClassBadge } from '../components/ClassBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SortableTable, type Column } from '../components/SortableTable';
import { useDataIndex } from '../lib/useDataIndex';
import { formatLapTime, formatDelta, formatSector } from '../lib/formatting';
import { getTheoreticalBest } from '../lib/analytics';
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
import type { RaceFile, CarClass, PersonalBest } from '../lib/types';

interface TrackModeViewProps {
  files: RaceFile[];
  driverNames: string[];
  initialTrack?: string | null;
  onNavigate?: (view: string, context?: string) => void;
  onViewChange?: (view: string) => void;
}

type LapLimit = '10' | 'all';

const RATING_ORDER: Record<PaceRating, number> = {
  'Alien': 0, 'Competitive': 1, 'Good': 2, 'Midpack': 3, 'Tail-ender': 4, 'Offline': 5,
};

const TIER_COLORS: Record<string, string> = {
  Hotlap: 'text-white',
  Alien: 'text-racing-purple',
  Competitive: 'text-racing-green',
  Good: 'text-racing-green/80',
  Midpack: 'text-racing-yellow',
  'Tail-ender': 'text-racing-orange',
  Offline: 'text-racing-red',
};

function getTierColor(tier: string): string {
  return TIER_COLORS[tier] ?? 'text-racing-muted';
}

function getTierBgColor(tier: string): string {
  if (tier === 'Hotlap') return 'bg-white/5 border-white/10';
  return getRatingBgColor(tier as PaceRating);
}

/** Unified track item for the pill selector */
interface TrackItem {
  id: string;
  label: string;
  trackCourse: string | null;
  benchmarkName: string | null;
  hasUserData: boolean;
}

type RowType = 'lap' | 'theoretical' | 'benchmark';

interface YourTimesRow {
  pb: PersonalBest;
  rateResult: { rating: PaceRating; delta: number; percent: number } | null;
  nextTarget: { label: PaceRating; time: number; gap: number } | null;
  rowType: RowType;
  /** For benchmark rows: the tier label */
  tierLabel?: string;
}

export const TrackModeView = memo(function TrackModeView({ files, driverNames, initialTrack, onNavigate, onViewChange }: TrackModeViewProps) {
  const { trackStats, personalBests, allLaps, driverSessions } = useDataIndex();

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(initialTrack ?? null);
  const [benchmarks, setBenchmarks] = useState<PaceBenchmark[] | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [lapLimit, setLapLimit] = useState<LapLimit>('10');
  const [showBenchmarks, setShowBenchmarks] = useState(true);
  const [showTheoretical, setShowTheoretical] = useState(true);

  // Load benchmarks
  useEffect(() => {
    let cancelled = false;
    fetchBenchmarks()
      .then(data => { if (!cancelled) setBenchmarks(data); })
      .catch(e => { if (!cancelled) setBenchmarkError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const benchmarkLoading = benchmarks === null && benchmarkError === null;

  // Active classes from filtered data (respects header class filter)
  const activeClasses = useMemo(() => {
    const classes = new Set<CarClass>();
    for (const pb of personalBests) classes.add(pb.carClass);
    return classes;
  }, [personalBests]);

  // Build unified track list: user tracks + benchmark-only tracks
  const allTracks = useMemo((): TrackItem[] => {
    const items: TrackItem[] = [];
    const coveredBenchmarkNames = new Set<string>();

    for (const ts of trackStats) {
      const bmName = mapTrackName(ts.trackCourse, ts.trackVenue);
      if (bmName) coveredBenchmarkNames.add(bmName);
      items.push({
        id: ts.trackCourse,
        label: ts.trackCourse,
        trackCourse: ts.trackCourse,
        benchmarkName: bmName,
        hasUserData: true,
      });
    }

    if (benchmarks) {
      const benchmarkTrackNames = [...new Set(benchmarks.map(b => b.track))];
      for (const bmName of benchmarkTrackNames) {
        if (coveredBenchmarkNames.has(bmName)) continue;
        items.push({
          id: `bm::${bmName}`,
          label: bmName,
          trackCourse: null,
          benchmarkName: bmName,
          hasUserData: false,
        });
      }
    }

    return items;
  }, [trackStats, benchmarks]);

  const trackId = selectedTrackId ?? allTracks[0]?.id ?? null;
  const currentTrack = useMemo(
    () => allTracks.find(t => t.id === trackId) ?? null,
    [allTracks, trackId],
  );

  const currentTrackStats = useMemo(
    () => currentTrack?.trackCourse ? trackStats.find(t => t.trackCourse === currentTrack.trackCourse) ?? null : null,
    [trackStats, currentTrack],
  );

  const trackSessions = useMemo(
    () => currentTrack?.trackCourse ? driverSessions.filter(ds => ds.file.trackCourse === currentTrack.trackCourse) : [],
    [driverSessions, currentTrack],
  );

  const trackLengthKm = useMemo(() => {
    if (!currentTrack?.trackCourse) return null;
    const file = files.find(f => f.trackCourse === currentTrack.trackCourse);
    return file ? file.trackLength / 1000 : null;
  }, [files, currentTrack]);

  // All laps at this track, sorted by time
  const trackLapsSorted = useMemo(
    () => currentTrack?.trackCourse
      ? allLaps
          .filter(lap => lap.trackCourse === currentTrack.trackCourse)
          .sort((a, b) => a.lapTime - b.lapTime)
      : [],
    [allLaps, currentTrack],
  );

  // Benchmarks for this track, filtered by active classes
  const trackBenchmarks = useMemo(() => {
    if (!benchmarks || !currentTrack?.benchmarkName) return [];
    return benchmarks.filter(b =>
      b.track === currentTrack.benchmarkName &&
      (activeClasses.size === 0 || activeClasses.has(b.carClass))
    );
  }, [benchmarks, currentTrack, activeClasses]);

  const validLaps = useMemo(() => {
    let count = 0;
    for (const ds of trackSessions) {
      for (const lap of ds.driver.laps) {
        if (lap.lapTime && lap.lapTime > 0) count++;
      }
    }
    return count;
  }, [trackSessions]);

  const totalLaps = useMemo(() => {
    let count = 0;
    for (const ds of trackSessions) {
      count += ds.driver.laps.length;
    }
    return count;
  }, [trackSessions]);

  // Best rating across all cars at this track
  const bestRating = useMemo((): { rating: PaceRating; carType: string } | null => {
    if (!benchmarks || trackLapsSorted.length === 0) return null;
    // Use personalBests for best-per-car rating
    const trackPBs = personalBests.filter(pb => pb.trackCourse === currentTrack?.trackCourse);
    let best: { rating: PaceRating; carType: string; order: number } | null = null;
    for (const pb of trackPBs) {
      const mapped = mapTrackName(pb.trackCourse, pb.trackVenue);
      if (!mapped) continue;
      const bm = benchmarks.find(b => b.track === mapped && b.carClass === pb.carClass);
      if (!bm) continue;
      const { rating } = rateLapTime(pb.lapTime, bm);
      const order = RATING_ORDER[rating];
      if (!best || order < best.order) {
        best = { rating, carType: pb.carType, order };
      }
    }
    return best;
  }, [benchmarks, trackLapsSorted, personalBests, currentTrack]);

  // Build "Your Times" rows: top N laps + benchmark tiers + theoretical bests
  const yourTimesRows = useMemo((): YourTimesRow[] => {
    if (!currentTrack?.trackCourse) return [];

    const rows: YourTimesRow[] = [];

    // 1. Actual laps (limited or all)
    const lapsToShow = lapLimit === '10' ? trackLapsSorted.slice(0, 10) : trackLapsSorted;
    for (const pb of lapsToShow) {
      const mapped = mapTrackName(pb.trackCourse, pb.trackVenue);
      const bm = mapped && benchmarks ? benchmarks.find(b => b.track === mapped && b.carClass === pb.carClass) ?? null : null;
      const rateResult = bm ? rateLapTime(pb.lapTime, bm) : null;
      const nextTarget = bm && rateResult ? getNextTarget(pb.lapTime, rateResult.rating, bm) : null;
      rows.push({ pb, rateResult, nextTarget, rowType: 'lap' });
    }

    // 2. Benchmark tier rows — hotlap + pace tiers, one per class
    if (showBenchmarks) {
      const TIERS: Array<{ key: keyof PaceBenchmark['racePace'] | 'hotlap'; label: string }> = [
        { key: 'hotlap', label: 'Hotlap' },
        { key: 'alien', label: 'Alien' },
        { key: 'competitive', label: 'Competitive' },
        { key: 'good', label: 'Good' },
        { key: 'midpack', label: 'Midpack' },
        { key: 'tailEnder', label: 'Tail-ender' },
        { key: 'offline', label: 'Offline' },
      ];
      for (const bm of trackBenchmarks) {
        for (const tier of TIERS) {
          const lapTime = tier.key === 'hotlap' ? bm.hotlapTime : bm.racePace[tier.key];
          const ratingLabel = tier.key === 'hotlap' ? 'Alien' : tier.label;
          const stubPb = {
            lapTime,
            sector1: null, sector2: null, sector3: null,
            topSpeed: 0,
            trackVenue: '', trackCourse: currentTrack.trackCourse ?? '',
            carType: tier.label, carClass: bm.carClass,
            sessionType: '' as PersonalBest['sessionType'],
            sessionIndex: 0, date: '', fileName: '', lapNumber: 0, driverName: '',
          } satisfies PersonalBest;
          rows.push({
            pb: stubPb,
            rateResult: { rating: ratingLabel as PaceRating, delta: 0, percent: (lapTime / bm.racePace.alien) * 100 },
            nextTarget: null,
            rowType: 'benchmark',
            tierLabel: tier.label,
          });
        }
      }
    }

    // 3. Theoretical bests per unique car
    if (!showTheoretical) return rows.sort((a, b) => a.pb.lapTime - b.pb.lapTime);
    const seenCars = new Set<string>();
    for (const pb of personalBests) {
      if (pb.trackCourse !== currentTrack.trackCourse) continue;
      if (seenCars.has(pb.carType)) continue;
      seenCars.add(pb.carType);

      const theoretical = getTheoreticalBest(files, driverNames, pb.trackCourse, pb.carType);
      if (theoretical.total === null || theoretical.total >= pb.lapTime) continue;

      const mapped = mapTrackName(pb.trackCourse, pb.trackVenue);
      const bm = mapped && benchmarks ? benchmarks.find(b => b.track === mapped && b.carClass === pb.carClass) ?? null : null;
      const rateResult = bm ? rateLapTime(theoretical.total, bm) : null;
      const nextTarget = bm && rateResult ? getNextTarget(theoretical.total, rateResult.rating, bm) : null;

      rows.push({
        pb: { ...pb, lapTime: theoretical.total, sector1: theoretical.s1, sector2: theoretical.s2, sector3: theoretical.s3 },
        rateResult,
        nextTarget,
        rowType: 'theoretical',
      });
    }

    // Sort all by lap time
    rows.sort((a, b) => a.pb.lapTime - b.pb.lapTime);

    return rows;
  }, [trackLapsSorted, lapLimit, benchmarks, trackBenchmarks, personalBests, currentTrack, files, driverNames, showBenchmarks, showTheoretical]);

  // Column definitions for SortableTable
  const benchmarkColumns: Column<PaceBenchmark>[] = useMemo(() => [
    { key: 'class', label: 'Class', width: '12%', sortValue: r => r.carClass,
      render: r => <ClassBadge carClass={r.carClass} /> },
    { key: 'hotlap', label: 'Hotlap', align: 'right', mono: true, width: '13%', sortValue: r => r.hotlapTime,
      render: r => <span className="text-white">{formatLapTime(r.hotlapTime)}</span> },
    { key: 'alien', label: 'Alien', align: 'right', mono: true, width: '13%', sortValue: r => r.racePace.alien,
      render: r => <span className="text-racing-purple">{formatLapTime(r.racePace.alien)}</span> },
    { key: 'competitive', label: 'Competitive', align: 'right', mono: true, width: '13%', sortValue: r => r.racePace.competitive,
      render: r => <span className="text-racing-green">{formatLapTime(r.racePace.competitive)}</span> },
    { key: 'good', label: 'Good', align: 'right', mono: true, width: '13%', sortValue: r => r.racePace.good,
      render: r => <span className="text-racing-green/80">{formatLapTime(r.racePace.good)}</span> },
    { key: 'midpack', label: 'Midpack', align: 'right', mono: true, width: '12%', sortValue: r => r.racePace.midpack,
      render: r => <span className="text-racing-yellow">{formatLapTime(r.racePace.midpack)}</span> },
    { key: 'tailEnder', label: 'Tail-ender', align: 'right', mono: true, width: '12%', sortValue: r => r.racePace.tailEnder,
      render: r => <span className="text-racing-orange">{formatLapTime(r.racePace.tailEnder)}</span> },
    { key: 'offline', label: 'Offline', align: 'right', mono: true, width: '12%', sortValue: r => r.racePace.offline,
      render: r => <span className="text-racing-red">{formatLapTime(r.racePace.offline)}</span> },
  ], []);

  // Pre-compute gap to next faster lap (row above in sorted order)
  const gapMap = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 1; i < yourTimesRows.length; i++) {
      map.set(i, yourTimesRows[i].pb.lapTime - yourTimesRows[i - 1].pb.lapTime);
    }
    return map;
  }, [yourTimesRows]);

  const yourTimesColumns: Column<YourTimesRow>[] = useMemo(() => [
    { key: 'car', label: 'Car', width: '22%', cellClass: 'pl-4 pr-1', sortValue: r => r.pb.carType,
      render: r => {
        if (r.rowType === 'benchmark') return <span className={`text-xs ${getTierColor(r.tierLabel!)} brightness-75`}>Benchmark {r.tierLabel}</span>;
        if (r.rowType === 'theoretical') return <span className="text-racing-purple text-xs font-medium">{r.pb.carType} <span className="text-[10px] opacity-60">(theoretical)</span></span>;
        return onNavigate
          ? <button onClick={() => onNavigate('cars', r.pb.carType)} className="text-white text-xs font-medium hover:text-racing-red transition-colors cursor-pointer text-left">{r.pb.carType}</button>
          : <span className="text-white text-xs font-medium">{r.pb.carType}</span>;
      } },
    { key: 'class', label: 'Class', width: '60px', cellClass: 'px-1', sortValue: r => r.pb.carClass,
      render: r => <ClassBadge carClass={r.pb.carClass} /> },
    { key: 'lapTime', label: 'Lap Time', align: 'right', mono: true, width: '10%', sortValue: r => r.pb.lapTime,
      render: r => {
        if (r.rowType === 'benchmark') return <span className={`${getTierColor(r.tierLabel!)} brightness-75`}>{formatLapTime(r.pb.lapTime)}</span>;
        if (r.rowType === 'theoretical') return <span className="text-racing-purple font-bold">{formatLapTime(r.pb.lapTime)}</span>;
        return <span className="text-white font-bold">{formatLapTime(r.pb.lapTime)}</span>;
      } },
    { key: 's1', label: 'S1', align: 'right', mono: true, width: '7%', cellClass: 'px-2', sortValue: r => r.pb.sector1,
      render: r => r.rowType === 'benchmark' ? <span className="text-racing-muted/30">--</span> : <span className="text-racing-muted text-xs">{formatSector(r.pb.sector1)}</span> },
    { key: 's2', label: 'S2', align: 'right', mono: true, width: '7%', cellClass: 'px-2', sortValue: r => r.pb.sector2,
      render: r => r.rowType === 'benchmark' ? <span className="text-racing-muted/30">--</span> : <span className="text-racing-muted text-xs">{formatSector(r.pb.sector2)}</span> },
    { key: 's3', label: 'S3', align: 'right', mono: true, width: '7%', cellClass: 'px-2', sortValue: r => r.pb.sector3,
      render: r => r.rowType === 'benchmark' ? <span className="text-racing-muted/30">--</span> : <span className="text-racing-muted text-xs">{formatSector(r.pb.sector3)}</span> },
    { key: 'rating', label: 'Rating', width: '95px', cellClass: 'pl-3 pr-1', sortValue: r => r.rateResult ? RATING_ORDER[r.rateResult.rating] ?? -1 : 99,
      render: r => {
        if (r.rowType === 'benchmark') return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border brightness-75 ${getTierColor(r.tierLabel!)} ${getTierBgColor(r.tierLabel!)}`}>{r.tierLabel}</span>;
        return r.rateResult
          ? <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getRatingColor(r.rateResult.rating)} ${getRatingBgColor(r.rateResult.rating)}`}>{r.rateResult.rating}</span>
          : <span className="text-racing-muted/40 text-xs">--</span>;
      } },
    { key: 'percent', label: '%', align: 'right', mono: true, width: '6%', cellClass: 'pl-0 pr-3', sortValue: r => r.rateResult?.percent ?? 999,
      render: r => <span className={`text-xs ${r.rowType === 'benchmark' ? 'text-racing-muted/40' : 'text-racing-muted'}`}>{r.rateResult ? `${r.rateResult.percent.toFixed(1)}%` : '--'}</span> },
    { key: 'gap', label: 'Gap', align: 'right', mono: true, width: '7%', cellClass: 'px-2', sortValue: r => r.pb.lapTime,
      render: (_r: YourTimesRow, i: number) => {
        const gap = gapMap.get(i);
        if (gap === undefined || i === 0) return <span className="text-racing-muted/20 text-xs">--</span>;
        return <span className="text-racing-muted text-xs">{formatDelta(gap)}</span>;
      } },
    { key: 'session', label: 'Session', width: '8%', cellClass: 'pl-4 pr-1', sortValue: r => r.rowType === 'lap' ? `${r.pb.sessionType} L${r.pb.lapNumber}` : 'zzz',
      render: r => {
        if (r.rowType === 'benchmark') return <span className={`text-[10px] ${getTierColor(r.tierLabel!)} brightness-50`}>benchmark</span>;
        if (r.rowType === 'theoretical') return <span className="text-racing-purple/50 text-[10px]">best sectors</span>;
        return <span className="text-racing-muted text-xs">{r.pb.sessionType} L{r.pb.lapNumber}</span>;
      } },
    { key: 'date', label: 'Date', width: '13%', sortValue: r => r.rowType === 'lap' ? r.pb.date : 'zzz',
      render: r => {
        if (r.rowType !== 'lap') return <span className="text-racing-muted/20 text-xs">--</span>;
        return <span className="text-racing-muted/60 text-xs font-mono">{r.pb.date}</span>;
      } },
  ], [onNavigate, gapMap]);

  if (allTracks.length === 0) {
    return (
      <div className="text-center py-20 text-racing-muted">
        <p className="text-lg">No track data available.</p>
        <p className="text-sm mt-1">Load some session files to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-navigation with track selector */}
      <div className="flex items-center gap-0 border-b border-racing-border/30">
        {onViewChange && (
          <button
            onClick={() => onViewChange('benchmarks')}
            className="px-5 py-2 text-xs font-medium tracking-[0.08em] uppercase whitespace-nowrap transition-all cursor-pointer border-b-2 -mb-px border-transparent text-racing-muted hover:text-racing-text"
          >
            Overview
          </button>
        )}
        <span className="px-5 py-2 text-xs font-medium tracking-[0.08em] uppercase whitespace-nowrap border-b-2 -mb-px border-racing-red text-white">
          Per Track
        </span>
        <div className="ml-4 flex items-center gap-2 py-1">
          <SearchableSelect
            value={trackId ?? ''}
            options={allTracks.map(t => ({ value: t.id, label: t.hasUserData ? t.label : `${t.label} (no data)` }))}
            onChange={setSelectedTrackId}
          />
        </div>
      </div>

      {currentTrack && (
        <>
          {/* Track Summary Stats */}
          {currentTrack.hasUserData && currentTrackStats && (
            <div className="data-card carbon-fiber p-6">
              <h2 className="font-racing text-xl text-white mb-4">{currentTrack.label}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-racing-muted text-[10px] uppercase tracking-wider mb-1">Sessions</div>
                  <div className="text-white text-lg font-mono font-bold">{trackSessions.length}</div>
                </div>
                <div>
                  <div className="text-racing-muted text-[10px] uppercase tracking-wider mb-1">Laps</div>
                  <div className="text-white text-lg font-mono font-bold">
                    {totalLaps}
                    {validLaps !== totalLaps && (
                      <span className="text-racing-muted text-xs ml-1">({validLaps} valid)</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-racing-muted text-[10px] uppercase tracking-wider mb-1">Best Lap</div>
                  <div className="text-racing-gold text-lg font-mono font-bold">
                    {formatLapTime(currentTrackStats.bestLapTime)}
                  </div>
                  {currentTrackStats.bestCar && (
                    <div className="text-racing-muted text-[10px] mt-0.5">{currentTrackStats.bestCar}</div>
                  )}
                </div>
                <div>
                  <div className="text-racing-muted text-[10px] uppercase tracking-wider mb-1">Best Rating</div>
                  {bestRating ? (
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getRatingColor(bestRating.rating)} ${getRatingBgColor(bestRating.rating)}`}>
                      {bestRating.rating}
                    </span>
                  ) : (
                    <span className="text-racing-muted text-sm">--</span>
                  )}
                </div>
                <div>
                  <div className="text-racing-muted text-[10px] uppercase tracking-wider mb-1">Track Length</div>
                  <div className="text-white text-lg font-mono font-bold">
                    {trackLengthKm !== null ? `${trackLengthKm.toFixed(2)} km` : '--'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benchmark-only track heading */}
          {!currentTrack.hasUserData && (
            <div className="data-card carbon-fiber p-6">
              <h2 className="font-racing text-xl text-white mb-2">{currentTrack.label}</h2>
              <p className="text-racing-muted text-xs">No sessions recorded — showing benchmark reference times only.</p>
            </div>
          )}

          {/* Benchmark Pace Reference */}
          {benchmarkLoading && (
            <div className="flex items-center justify-center py-8 text-racing-muted gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading benchmarks...</span>
            </div>
          )}

          {trackBenchmarks.length > 0 && (
            <div className="data-card carbon-fiber overflow-hidden">
              <DataCardHeader title="PACE REFERENCE">
                <div className="flex flex-wrap items-center gap-2.5 text-[10px] uppercase tracking-wider">
                  {Object.entries(TIER_COLORS).map(([label, color]) => (
                    <span key={label} className={`${color} font-semibold`}>{label}</span>
                  ))}
                </div>
              </DataCardHeader>
              <SortableTable<PaceBenchmark>
                columns={benchmarkColumns}
                data={trackBenchmarks}
                rowKey={bm => bm.carClass}
              />
            </div>
          )}

          {!benchmarkLoading && benchmarks && trackBenchmarks.length === 0 && !currentTrack.benchmarkName && (
            <div className="text-center py-8 text-racing-muted text-sm">
              No benchmark data available for this track.
            </div>
          )}

          {/* Your Times */}
          {yourTimesRows.length > 0 && (
            <div className="data-card carbon-fiber overflow-hidden">
              <DataCardHeader title="YOUR TIMES">
                <button onClick={() => setShowBenchmarks(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
                    ${showBenchmarks ? 'bg-racing-red/15 text-racing-red border border-racing-red/25' : 'bg-racing-card border border-racing-border text-racing-muted hover:text-racing-text'}`}>
                  <Gauge className="w-3 h-3" /> Benchmarks
                </button>
                <button onClick={() => setShowTheoretical(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
                    ${showTheoretical ? 'bg-racing-purple/15 text-racing-purple border border-racing-purple/25' : 'bg-racing-card border border-racing-border text-racing-muted hover:text-racing-text'}`}>
                  <Zap className="w-3 h-3" /> Theoretical
                </button>
                <span className="text-[10px] font-mono text-racing-muted/50">{trackLapsSorted.length} laps</span>
                <FilterButtonGroup
                  options={[{ value: '10' as LapLimit, label: 'Top 10' }, { value: 'all' as LapLimit, label: 'All' }]}
                  value={lapLimit}
                  onChange={setLapLimit}
                />
              </DataCardHeader>
              <SortableTable<YourTimesRow>
                columns={yourTimesColumns}
                data={yourTimesRows}
                rowKey={(r, i) => {
                  if (r.rowType === 'benchmark') return `bm-${r.pb.carClass}-${r.tierLabel}`;
                  if (r.rowType === 'theoretical') return `theo-${r.pb.carType}`;
                  return `${r.pb.carType}-${r.pb.fileName}-${r.pb.lapNumber}-${i}`;
                }}
                rowClass={r => {
                  if (r.rowType === 'benchmark') return `${getTierBgColor(r.tierLabel!).split(' ')[0]}/[0.03]`;
                  if (r.rowType === 'theoretical') return 'bg-racing-purple/[0.04]';
                  return '';
                }}
              />
            </div>
          )}

          {trackBenchmarks.length > 0 && <OhneSpeedCredit />}
        </>
      )}
    </div>
  );
});
