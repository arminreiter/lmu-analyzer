import { useState, useMemo, memo } from 'react';
import { ArrowLeft, Info, Timer, BarChart3, AlertTriangle, Ban, ShieldAlert } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { formatLapTime, formatSector, formatEventTime, isDriverIncident, getChartTooltipStyle } from '../lib/analytics';
import type { RaceFile, SessionData, DriverResult, LapData } from '../lib/types';

type Tab = 'overview' | 'laps' | 'charts' | 'incidents' | 'penalties' | 'tracklimits';

interface SessionDetailViewProps {
  file: RaceFile;
  session: SessionData;
  driver: DriverResult;
  onBack: () => void;
}

export const SessionDetailView = memo(function SessionDetailView({ file, session, driver, onBack }: SessionDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const validLaps = useMemo(() => driver.laps.filter(l => l.lapTime && l.lapTime > 0), [driver.laps]);

  const driverIncidents = useMemo(() =>
    session.incidents.filter(i => isDriverIncident(i, driver.name)),
    [session.incidents, driver.name]
  );
  const driverPenalties = useMemo(() =>
    session.penalties.filter(p => p.driver === driver.name),
    [session.penalties, driver.name]
  );
  const driverTrackLimits = useMemo(() =>
    session.trackLimits.filter(tl => tl.driver === driver.name),
    [session.trackLimits, driver.name]
  );

  // Consistency stats
  const stats = useMemo(() => {
    if (validLaps.length === 0) return null;
    const times = validLaps.map(l => l.lapTime!);
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
    const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
    const consistency = ((1 - stdDev / avg) * 100);

    const speeds = validLaps.map(l => l.topSpeed);
    const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    const topSpeed = Math.max(...speeds);

    // Fuel consumption per lap
    const fuelLaps = driver.laps.filter(l => l.fuelUsed > 0);
    const avgFuelPerLap = fuelLaps.length > 0
      ? (fuelLaps.reduce((s, l) => s + l.fuelUsed, 0) / fuelLaps.length) * 100
      : null;

    return { best, worst, avg, median, stdDev, consistency, avgSpeed, topSpeed, avgFuelPerLap };
  }, [validLaps, driver.laps]);

  // Session standings (all drivers in this session)
  const standings = useMemo(() => {
    const sorted = [...session.drivers].sort((a, b) => {
      if (session.type === 'Race') return a.position - b.position;
      return (a.bestLapTime ?? Infinity) - (b.bestLapTime ?? Infinity);
    });
    return sorted;
  }, [session]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-3.5 h-3.5" /> },
    { id: 'laps', label: 'Lap Details', icon: <Timer className="w-3.5 h-3.5" /> },
    { id: 'charts', label: 'Charts', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" />, count: driverIncidents.length },
    { id: 'penalties', label: 'Penalties', icon: <Ban className="w-3.5 h-3.5" />, count: driverPenalties.length },
    { id: 'tracklimits', label: 'Track Limits', icon: <ShieldAlert className="w-3.5 h-3.5" />, count: driverTrackLimits.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-racing-muted hover:text-white hover:bg-racing-highlight/20 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded text-xs font-bold
              ${session.type === 'Race' ? 'bg-racing-red/20 text-racing-red' :
                session.type === 'Qualifying' ? 'bg-racing-yellow/20 text-racing-yellow' :
                'bg-racing-blue/20 text-racing-blue'}`}>
              {session.type}
            </span>
            <h1 className="font-racing text-lg font-bold text-white tracking-wider truncate">{file.trackCourse}</h1>
            <ClassBadge carClass={driver.carClass} />
          </div>
          <p className="text-racing-muted text-xs mt-0.5">
            {driver.carType} &middot; #{driver.carNumber} &middot; {file.timeString}
            {file.setting === 'Multiplayer' && <span className="text-racing-blue ml-2">Online</span>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-0 border-b border-racing-border overflow-x-auto scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-racing-red text-white'
                : 'border-transparent text-racing-muted hover:text-racing-text'}`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${tab.id === 'incidents' ? 'bg-racing-orange/20 text-racing-orange' :
                  tab.id === 'penalties' ? 'bg-racing-red/20 text-racing-red' :
                  'bg-racing-yellow/20 text-racing-yellow'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab file={file} session={session} driver={driver} stats={stats} standings={standings} />
      )}
      {activeTab === 'laps' && <LapsTab driver={driver} validLaps={validLaps} />}
      {activeTab === 'charts' && <ChartsTab driver={driver} validLaps={validLaps} />}
      {activeTab === 'incidents' && <IncidentsTab incidents={driverIncidents} />}
      {activeTab === 'penalties' && <PenaltiesTab penalties={driverPenalties} />}
      {activeTab === 'tracklimits' && <TrackLimitsTab trackLimits={driverTrackLimits} />}
    </div>
  );
});

// ── Overview Tab ──────────────────────────────────────────────────────────────

interface StatsData {
  best: number; worst: number; avg: number; median: number;
  stdDev: number; consistency: number; avgSpeed: number; topSpeed: number;
  avgFuelPerLap: number | null;
}

function OverviewTab({ file, session, driver, stats, standings }: {
  file: RaceFile; session: SessionData; driver: DriverResult;
  stats: StatsData | null; standings: DriverResult[];
}) {
  // Find current driver index in standings
  const driverIdx = standings.findIndex(d => d.name === driver.name);

  const standingsColumns: Column<DriverResult>[] = useMemo(() => [
    { key: 'pos', label: 'Pos', width: '50px', sortValue: r => session.type === 'Race' ? r.position : (r.bestLapTime ?? Infinity),
      render: (_r: DriverResult, i: number) => <span className={`font-bold ${i === 0 ? 'text-racing-gold' : i <= 2 ? 'text-racing-orange' : 'text-racing-muted'}`}>{i + 1}</span> },
    { key: 'name', label: 'Driver', width: '15%', sortValue: r => r.name,
      render: r => <span className={`truncate block ${r.name === driver.name ? 'text-racing-green font-bold' : 'text-white'}`}>{r.name}</span> },
    { key: 'car', label: 'Car', width: '15%', sortValue: r => r.carType,
      render: r => <div className="flex items-center gap-1.5 truncate"><span className="text-racing-muted text-xs truncate">{r.carType}</span><ClassBadge carClass={r.carClass} /></div> },
    { key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '120px', sortValue: r => r.bestLapTime ?? Infinity,
      render: r => <span className="text-racing-green">{formatLapTime(r.bestLapTime)}</span> },
    { key: 'laps', label: 'Laps', align: 'right', width: '55px', sortValue: r => r.totalLaps,
      render: r => <span className="text-racing-muted">{r.totalLaps}</span> },
    ...(session.type === 'Race' ? [
      { key: 'time', label: 'Total Time', align: 'right' as const, mono: true, width: '120px', sortValue: (r: DriverResult) => r.finishTime ?? Infinity,
        render: (r: DriverResult) => <span className="text-racing-muted">{r.finishTime ? formatEventTime(r.finishTime) : '--'}</span> },
      { key: 'pits', label: 'Pits', align: 'right' as const, width: '50px', sortValue: (r: DriverResult) => r.pitstops,
        render: (r: DriverResult) => <span className="text-racing-muted">{r.pitstops}</span> },
      { key: 'strategy', label: 'Strategy', width: '180px', sortValue: (r: DriverResult) => r.pitstops,
        render: (r: DriverResult) => <TireStrategy laps={r.laps} /> },
      { key: 'status', label: 'Status', width: '120px', sortValue: (r: DriverResult) => r.finishStatus,
        render: (r: DriverResult) => <span className={`text-xs ${r.finishStatus === 'Finished Normally' ? 'text-racing-green' : 'text-racing-red'}`}>{r.finishStatus}</span> },
    ] : []),
  ], [session.type, driver.name]);

  return (
    <div className="space-y-5">
      {/* Session Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Driver Info */}
        <div className="data-card carbon-fiber p-5">
          <h3 className="text-xs uppercase tracking-wider text-racing-muted mb-3 font-medium">Driver Info</h3>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
            <InfoRow label="Team" value={driver.teamName} />
            <InfoRow label="Car #" value={driver.carNumber} />
            <InfoRow label="Status" value={driver.finishStatus}
              valueClass={driver.finishStatus === 'Finished Normally' ? 'text-racing-green' : 'text-racing-red'} />
            <InfoRow label="Pitstops" value={String(driver.pitstops)} />
            {session.type === 'Race' && (
              <>
                <InfoRow label="Position" value={`P${driver.position} / ${session.drivers.length}`} valueClass="text-racing-gold font-bold" />
                <InfoRow label="Class Pos" value={`P${driver.classPosition}`} valueClass="text-racing-gold font-bold" />
                {driver.gridPosition && (
                  <InfoRow label="Grid" value={`P${driver.gridPosition}`} />
                )}
                {driver.gridPosition && (
                  <InfoRow label="Gain"
                    value={`${driver.gridPosition - driver.position > 0 ? '+' : ''}${driver.gridPosition - driver.position}`}
                    valueClass={driver.gridPosition - driver.position > 0 ? 'text-racing-green' : driver.gridPosition - driver.position < 0 ? 'text-racing-red' : 'text-racing-muted'} />
                )}
              </>
            )}
            {driver.controlAndAids && (
              <div className="col-span-2">
                <span className="text-racing-muted">Aids:</span>{' '}
                <span className="text-racing-muted/70 text-xs">{driver.controlAndAids}</span>
              </div>
            )}
          </div>
        </div>

        {/* Session Settings */}
        <div className="data-card carbon-fiber p-5">
          <h3 className="text-xs uppercase tracking-wider text-racing-muted mb-3 font-medium">Session Settings</h3>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
            <InfoRow label="Track" value={`${file.trackVenue} — ${file.trackCourse}`} />
            <InfoRow label="Setting" value={file.setting} />
            {file.serverName && <InfoRow label="Server" value={file.serverName} />}
            <InfoRow label="Track Length" value={`${(file.trackLength / 1000).toFixed(2)} km`} />
            {session.lapsLimit > 0 && <InfoRow label="Lap Limit" value={String(session.lapsLimit)} />}
            {session.minutesLimit > 0 && <InfoRow label="Time Limit" value={`${session.minutesLimit} min`} />}
            <InfoRow label="Drivers" value={String(session.drivers.length)} />
            <InfoRow label="Game Version" value={file.gameVersion} />
            {file.damageMult !== 1 && <InfoRow label="Damage" value={`${(file.damageMult * 100).toFixed(0)}%`} />}
            {file.fuelMult !== 1 && <InfoRow label="Fuel Rate" value={`${(file.fuelMult * 100).toFixed(0)}%`} />}
            {file.tireMult !== 1 && <InfoRow label="Tire Rate" value={`${(file.tireMult * 100).toFixed(0)}%`} />}
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      {stats && (
        <div className="data-card carbon-fiber p-5">
          <h3 className="text-xs uppercase tracking-wider text-racing-muted mb-3 font-medium">Performance</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
            <MiniStat label="Best Lap" value={formatLapTime(stats.best)} accent="text-racing-green" />
            <MiniStat label="Worst Lap" value={formatLapTime(stats.worst)} />
            <MiniStat label="Average" value={formatLapTime(stats.avg)} />
            <MiniStat label="Median" value={formatLapTime(stats.median)} />
            <MiniStat label="Std Dev" value={`${stats.stdDev.toFixed(3)}s`} />
            <MiniStat label="Consistency" value={`${stats.consistency.toFixed(1)}%`}
              accent={stats.consistency > 98 ? 'text-racing-green' : stats.consistency > 95 ? 'text-racing-yellow' : 'text-racing-orange'} />
            <MiniStat label="Top Speed" value={`${stats.topSpeed.toFixed(0)} km/h`} accent="text-racing-orange" />
            <MiniStat label="Avg Speed" value={`${stats.avgSpeed.toFixed(0)} km/h`} />
            {stats.avgFuelPerLap !== null && (
              <MiniStat label="Fuel/Lap" value={`${stats.avgFuelPerLap.toFixed(2)}%`} accent="text-racing-yellow" />
            )}
          </div>
        </div>
      )}

      {/* Standings */}
      <div className="data-card carbon-fiber overflow-hidden">
        <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
          <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">
            {session.type === 'Race' ? 'RACE STANDINGS' : 'SESSION STANDINGS'}
          </h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">
            {session.drivers.length} drivers
            {driverIdx >= 0 && ` · You: P${driverIdx + 1}`}
          </span>
          <ExportButton columns={standingsColumns} data={standings} filename={`lmu-standings-${file.trackCourse.toLowerCase().replace(/\s+/g, '-')}-${session.type.toLowerCase()}`} />
        </div>
        <SortableTable<DriverResult>
          columns={standingsColumns}
          data={standings}
          rowKey={r => r.name}
          rowClass={r => r.name === driver.name ? 'bg-racing-green/[0.06]' : ''}
        />
      </div>
    </div>
  );
}

const COMPOUND_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  Soft: { label: 'S', bg: 'bg-red-600', text: 'text-white' },
  Medium: { label: 'M', bg: 'bg-yellow-500', text: 'text-black' },
  Hard: { label: 'H', bg: 'bg-white', text: 'text-black' },
  Wet: { label: 'W', bg: 'bg-blue-500', text: 'text-white' },
  Inter: { label: 'I', bg: 'bg-green-500', text: 'text-black' },
  Intermediate: { label: 'I', bg: 'bg-green-500', text: 'text-black' },
};

function TireStrategy({ laps }: { laps: LapData[] }) {
  if (!laps.length) return <span className="text-racing-muted">--</span>;

  const stints: { compound: string; startLap: number; endLap: number }[] = [];
  let current = laps[0].frontCompound || 'N/A';
  let start = 1;

  for (let i = 1; i < laps.length; i++) {
    const c = laps[i].frontCompound || 'N/A';
    if (c !== current && c !== 'N/A') {
      stints.push({ compound: current, startLap: start, endLap: i });
      current = c;
      start = i + 1;
    }
  }
  stints.push({ compound: current, startLap: start, endLap: laps.length });

  if (stints.length === 1 && stints[0].compound === 'N/A') {
    return <span className="text-racing-muted">--</span>;
  }

  return (
    <div className="flex items-center gap-0.5">
      {stints.map((stint, i) => {
        const style = COMPOUND_STYLE[stint.compound] ?? { label: stint.compound[0] ?? '?', bg: 'bg-racing-muted/30', text: 'text-white' };
        return (
          <div key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-racing-muted/40 text-[9px] font-mono">{stint.startLap}</span>}
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${style.bg} ${style.text}`} title={`${stint.compound} (L${stint.startLap}–${stint.endLap})`}>
              {style.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <span className="text-racing-muted">{label}:</span>{' '}
      <span className={valueClass ?? 'text-white'}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <p className="text-racing-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className={`font-mono text-sm font-bold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Laps Tab ─────────────────────────────────────────────────────────────────

function LapsTab({ driver, validLaps }: { driver: DriverResult; validLaps: LapData[] }) {
  const { bestS1, bestS2, bestS3 } = useMemo(() => ({
    bestS1: Math.min(...validLaps.map(l => l.sector1 ?? Infinity)),
    bestS2: Math.min(...validLaps.map(l => l.sector2 ?? Infinity)),
    bestS3: Math.min(...validLaps.map(l => l.sector3 ?? Infinity)),
  }), [validLaps]);

  const columns: Column<LapData>[] = useMemo(() => [
    { key: 'lap', label: 'Lap', width: '50px', sortValue: r => r.num,
      render: r => <span className="text-racing-muted">{r.num}</span> },
    { key: 'time', label: 'Time', align: 'right', mono: true, width: '10%', sortValue: r => r.lapTime,
      render: r => {
        const isBest = r.lapTime !== null && r.lapTime === driver.bestLapTime;
        return <span className={isBest ? 'text-racing-green font-bold' : 'text-white'}>{formatLapTime(r.lapTime)}</span>;
      } },
    { key: 's1', label: 'S1', align: 'right', mono: true, width: '8%', sortValue: r => r.sector1,
      render: r => <span className={r.sector1 !== null && r.sector1 <= bestS1 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector1)}</span> },
    { key: 's2', label: 'S2', align: 'right', mono: true, width: '8%', sortValue: r => r.sector2,
      render: r => <span className={r.sector2 !== null && r.sector2 <= bestS2 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector2)}</span> },
    { key: 's3', label: 'S3', align: 'right', mono: true, width: '8%', sortValue: r => r.sector3,
      render: r => <span className={r.sector3 !== null && r.sector3 <= bestS3 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{formatSector(r.sector3)}</span> },
    { key: 'speed', label: 'Top Speed', align: 'right', mono: true, width: '8%', sortValue: r => r.topSpeed,
      render: r => <span className="text-racing-orange">{r.topSpeed.toFixed(0)}</span> },
    { key: 'fuel', label: 'Fuel', align: 'right', mono: true, width: '6%', sortValue: r => r.fuel,
      render: r => <span className="text-racing-yellow">{(r.fuel * 100).toFixed(0)}%</span> },
    { key: 'fuelUsed', label: 'Used', align: 'right', mono: true, width: '6%', sortValue: r => r.fuelUsed,
      render: r => <span className="text-racing-yellow/60">{r.fuelUsed > 0 ? `${(r.fuelUsed * 100).toFixed(2)}%` : '--'}</span> },
    { key: 'tires', label: 'Tires (FL/FR/RL/RR)', align: 'right', mono: true, width: '14%',
      sortValue: r => (r.tireWear.fl + r.tireWear.fr + r.tireWear.rl + r.tireWear.rr) / 4,
      render: r => <span className="text-racing-muted">{(r.tireWear.fl*100).toFixed(0)}/{(r.tireWear.fr*100).toFixed(0)}/{(r.tireWear.rl*100).toFixed(0)}/{(r.tireWear.rr*100).toFixed(0)}</span> },
    { key: 'compound', label: 'Cmpd', align: 'center', width: '55px', sortValue: r => r.frontCompound,
      render: r => <span className="text-racing-muted">{r.frontCompound}</span> },
    { key: 'pit', label: 'Pit', align: 'center', width: '45px', sortValue: r => r.isPit ? 1 : 0,
      render: r => r.isPit ? <span className="text-racing-blue font-bold">PIT</span> : null },
  ], [driver.bestLapTime, bestS1, bestS2, bestS3]);

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
        <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">LAP DETAILS</h3>
        <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{driver.laps.length} laps</span>
        <ExportButton columns={columns} data={driver.laps} filename="lmu-lap-details" />
      </div>
      <SortableTable<LapData>
        columns={columns}
        data={driver.laps}
        rowKey={r => String(r.num)}
        rowClass={r => r.lapTime !== null && r.lapTime === driver.bestLapTime ? 'bg-racing-green/[0.04]' : ''}
      />
    </div>
  );
}

// ── Charts Tab ───────────────────────────────────────────────────────────────

function ChartsTab({ driver, validLaps }: { driver: DriverResult; validLaps: LapData[] }) {
  const lapChartData = useMemo(() => validLaps.map(l => ({
    lap: l.num,
    time: l.lapTime,
    s1: l.sector1,
    s2: l.sector2,
    s3: l.sector3,
  })), [validLaps]);

  const tireData = useMemo(() => driver.laps.filter(l => l.tireWear.fl > 0).map(l => ({
    lap: l.num,
    FL: +(l.tireWear.fl * 100).toFixed(1),
    FR: +(l.tireWear.fr * 100).toFixed(1),
    RL: +(l.tireWear.rl * 100).toFixed(1),
    RR: +(l.tireWear.rr * 100).toFixed(1),
  })), [driver.laps]);

  const fuelData = useMemo(() => driver.laps.filter(l => l.fuel > 0).map(l => ({
    lap: l.num,
    fuel: +(l.fuel * 100).toFixed(1),
    used: +(l.fuelUsed * 100).toFixed(2),
  })), [driver.laps]);

  const speedData = useMemo(() => validLaps.map(l => ({
    lap: l.num,
    speed: l.topSpeed,
  })), [validLaps]);

  return (
    <div className="space-y-5">
      {/* Lap Times */}
      {lapChartData.length > 1 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">LAP TIMES</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lapChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: 'Lap', fill: '#6b7280', fontSize: 11, position: 'bottom' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => formatLapTime(v)} />
              <Tooltip contentStyle={getChartTooltipStyle()}
                formatter={(v: unknown) => formatLapTime(v as number)} />
              <Line type="monotone" dataKey="time" stroke="#e10600" strokeWidth={2} dot={{ fill: '#e10600', r: 3 }} name="Lap Time" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sector Times */}
      {lapChartData.some(d => d.s1 && d.s2 && d.s3) && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">SECTOR TIMES</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lapChartData.filter(d => d.s1 && d.s2 && d.s3)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={getChartTooltipStyle()} formatter={(v: unknown) => `${Number(v).toFixed(3)}s`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="s1" fill="#9c27b0" name="S1" stackId="a" />
              <Bar dataKey="s2" fill="#2196f3" name="S2" stackId="a" />
              <Bar dataKey="s3" fill="#ff6d00" name="S3" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Speed */}
      {speedData.length > 1 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">TOP SPEED</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={speedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={getChartTooltipStyle()} formatter={(v: unknown) => [`${Number(v).toFixed(1)} km/h`, 'Speed']} />
              <Line type="monotone" dataKey="speed" stroke="#ff6d00" strokeWidth={2} dot={{ fill: '#ff6d00', r: 3 }} name="Top Speed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tire Wear */}
      {tireData.length > 1 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">TIRE WEAR (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tireData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={getChartTooltipStyle()} formatter={(v: unknown) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="FL" stroke="#e10600" strokeWidth={1.5} dot={false} name="Front Left" />
              <Line type="monotone" dataKey="FR" stroke="#ff6d00" strokeWidth={1.5} dot={false} name="Front Right" />
              <Line type="monotone" dataKey="RL" stroke="#2196f3" strokeWidth={1.5} dot={false} name="Rear Left" />
              <Line type="monotone" dataKey="RR" stroke="#00c853" strokeWidth={1.5} dot={false} name="Rear Right" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fuel */}
      {fuelData.length > 1 && (
        <div className="data-card carbon-fiber p-4">
          <h3 className="font-racing text-sm font-bold text-white tracking-wider mb-4">FUEL</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={fuelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={getChartTooltipStyle()} formatter={(v: unknown) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="fuel" stroke="#ffd600" strokeWidth={2} dot={false} name="Fuel Level %" />
              <Line type="monotone" dataKey="used" stroke="#ff9800" strokeWidth={1.5} dot={false} name="Used per Lap %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {lapChartData.length <= 1 && tireData.length <= 1 && fuelData.length <= 1 && (
        <div className="text-center py-12 text-racing-muted">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Not enough lap data for charts.</p>
        </div>
      )}
    </div>
  );
}

// ── Incidents Tab ────────────────────────────────────────────────────────────

function IncidentsTab({ incidents }: { incidents: SessionDetailViewProps['session']['incidents'] }) {
  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 text-racing-muted">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No incidents recorded in this session.</p>
      </div>
    );
  }

  const columns: Column<typeof incidents[0]>[] = [
    { key: 'time', label: 'Time', width: '65px', mono: true, sortValue: r => r.time,
      render: r => <span className="text-racing-muted">{formatEventTime(r.time)}</span> },
    { key: 'desc', label: 'Description', width: '60%', sortValue: r => r.description,
      render: r => <span className="text-racing-text truncate block">{r.description}</span> },
    { key: 'driver2', label: 'Other Driver', width: '150px', sortValue: r => r.driver2 ?? '',
      render: r => r.driver2 ? <span className="text-racing-muted">{r.driver2}</span> : <span className="text-racing-muted/30">--</span> },
    { key: 'severity', label: 'Severity', align: 'right', width: '160px', mono: true, sortValue: r => r.severity,
      render: r => {
        if (r.severity <= 0) return <span className="text-racing-muted/30">--</span>;
        const color = r.severity >= 4000 ? 'text-racing-red' : r.severity >= 1000 ? 'text-racing-orange' : 'text-racing-green';
        const label = r.severity >= 4000 ? 'high' : r.severity >= 1000 ? 'medium' : 'low';
        return <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap"><span className={`${color} font-bold`}>{r.severity.toFixed(2)}</span><span className={`${color} text-[10px] w-10 text-right cursor-default`} title={"Low: < 1000\nMedium: 1000–4000\nHigh: > 4000"}>{label}</span></span>;
      } },
  ];

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
        <h3 className="section-stripe font-racing text-xs font-bold text-racing-orange tracking-[0.1em]">
          INCIDENTS ({incidents.length})
        </h3>
        <span className="ml-auto" />
        <ExportButton columns={columns} data={incidents} filename="lmu-incidents" />
      </div>
      <SortableTable columns={columns} data={incidents} rowKey={(_, i) => String(i)}
        rowClass={() => 'bg-racing-orange/[0.02]'} />
    </div>
  );
}

// ── Penalties Tab ────────────────────────────────────────────────────────────

function PenaltiesTab({ penalties }: { penalties: SessionDetailViewProps['session']['penalties'] }) {
  if (penalties.length === 0) {
    return (
      <div className="text-center py-12 text-racing-muted">
        <Ban className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No penalties in this session.</p>
      </div>
    );
  }

  const columns: Column<typeof penalties[0]>[] = [
    { key: 'time', label: 'Time', width: '120px', mono: true, sortValue: r => r.time,
      render: r => <span className="text-racing-muted">{formatEventTime(r.time)}</span> },
    { key: 'type', label: 'Type', width: '130px', sortValue: r => r.type,
      render: r => <span className="text-racing-red font-bold">{r.type}</span> },
    { key: 'reason', label: 'Reason', width: '120px', sortValue: r => r.reason,
      render: r => <span className="text-racing-text">{r.reason}</span> },
    { key: 'details', label: 'Details', sortValue: r => r.description,
      render: r => <span className="text-racing-muted/70 whitespace-normal break-words">{r.description !== r.reason ? r.description : ''}</span> },
  ];

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
        <h3 className="section-stripe font-racing text-xs font-bold text-racing-red tracking-[0.1em]">
          PENALTIES ({penalties.length})
        </h3>
        <span className="ml-auto" />
        <ExportButton columns={columns} data={penalties} filename="lmu-penalties" />
      </div>
      <SortableTable columns={columns} data={penalties} rowKey={(_, i) => String(i)}
        rowClass={() => 'bg-racing-red/[0.02]'} />
    </div>
  );
}

// ── Track Limits Tab ─────────────────────────────────────────────────────────

function TrackLimitsTab({ trackLimits }: { trackLimits: SessionDetailViewProps['session']['trackLimits'] }) {
  if (trackLimits.length === 0) {
    return (
      <div className="text-center py-12 text-racing-muted">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No track limit violations in this session.</p>
      </div>
    );
  }

  const columns: Column<typeof trackLimits[0]>[] = [
    { key: 'time', label: 'Time', width: '120px', mono: true, sortValue: r => r.time,
      render: r => <span className="text-racing-muted">{formatEventTime(r.time)}</span> },
    { key: 'lap', label: 'Lap', align: 'right', width: '60px', sortValue: r => r.lap,
      render: r => <span className="text-white">{r.lap}</span> },
    { key: 'warning', label: 'Warning Pts', align: 'right', width: '90px', mono: true, sortValue: r => r.warningPoints,
      render: r => <span className="text-racing-yellow">{r.warningPoints}</span> },
    { key: 'current', label: 'Total Pts', align: 'right', width: '80px', mono: true, sortValue: r => r.currentPoints,
      render: r => <span className="text-racing-yellow font-bold">{r.currentPoints}</span> },
    { key: 'resolution', label: 'Resolution', sortValue: r => r.resolution,
      render: r => <span className="text-racing-muted">{r.resolution}</span> },
  ];

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
        <h3 className="section-stripe font-racing text-xs font-bold text-racing-yellow tracking-[0.1em]">
          TRACK LIMITS ({trackLimits.length})
        </h3>
        <span className="ml-auto" />
        <ExportButton columns={columns} data={trackLimits} filename="lmu-track-limits" />
      </div>
      <SortableTable columns={columns} data={trackLimits} rowKey={(_, i) => String(i)}
        rowClass={() => 'bg-racing-yellow/[0.02]'} />
    </div>
  );
}
