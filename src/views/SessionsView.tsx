import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, formatEventTime, getDriverSessions } from '../lib/analytics';
import type { RaceFile, DriverResult, SessionData, LapData } from '../lib/types';

interface SessionsViewProps {
  files: RaceFile[];
  driverNames: string[];
}

function LapDetailsTable({ driver }: { driver: DriverResult }) {
  const validLaps = driver.laps.filter(l => l.lapTime && l.lapTime > 0);
  const bestS1 = Math.min(...validLaps.map(l => l.sector1 ?? Infinity));
  const bestS2 = Math.min(...validLaps.map(l => l.sector2 ?? Infinity));
  const bestS3 = Math.min(...validLaps.map(l => l.sector3 ?? Infinity));

  const columns: Column<LapData>[] = useMemo(() => [
    { key: 'lap', label: 'Lap', width: '50px', sortValue: r => r.num,
      render: r => <span className="text-racing-muted">{r.num}</span> },
    { key: 'time', label: 'Time', align: 'right', mono: true, width: '10%', sortValue: r => r.lapTime,
      render: r => {
        const isBest = r.lapTime !== null && r.lapTime === driver.bestLapTime;
        return <span className={isBest ? 'text-racing-green font-bold' : 'text-white'}>{formatLapTime(r.lapTime)}</span>;
      } },
    { key: 's1', label: 'S1', align: 'right', mono: true, width: '8%', sortValue: r => r.sector1,
      render: r => <span className={r.sector1 !== null && r.sector1 <= bestS1 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector1?.toFixed(3) ?? '--'}</span> },
    { key: 's2', label: 'S2', align: 'right', mono: true, width: '8%', sortValue: r => r.sector2,
      render: r => <span className={r.sector2 !== null && r.sector2 <= bestS2 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector2?.toFixed(3) ?? '--'}</span> },
    { key: 's3', label: 'S3', align: 'right', mono: true, width: '8%', sortValue: r => r.sector3,
      render: r => <span className={r.sector3 !== null && r.sector3 <= bestS3 ? 'text-racing-green font-medium' : 'text-racing-muted'}>{r.sector3?.toFixed(3) ?? '--'}</span> },
    { key: 'speed', label: 'Top Speed', align: 'right', mono: true, width: '8%', sortValue: r => r.topSpeed,
      render: r => <span className="text-racing-orange">{r.topSpeed.toFixed(0)}</span> },
    { key: 'fuel', label: 'Fuel', align: 'right', mono: true, width: '6%', sortValue: r => r.fuel,
      render: r => <span className="text-racing-yellow">{(r.fuel * 100).toFixed(0)}%</span> },
    { key: 'tires', label: 'Tires', align: 'right', mono: true, width: '14%',
      sortValue: r => (r.tireWear.fl + r.tireWear.fr + r.tireWear.rl + r.tireWear.rr) / 4,
      render: r => <span className="text-racing-muted">{(r.tireWear.fl*100).toFixed(0)}/{(r.tireWear.fr*100).toFixed(0)}/{(r.tireWear.rl*100).toFixed(0)}/{(r.tireWear.rr*100).toFixed(0)}</span> },
    { key: 'compound', label: 'Cmpd', align: 'center', width: '7%', sortValue: r => r.frontCompound,
      render: r => <span className="text-racing-muted">{r.frontCompound}</span> },
    { key: 'pit', label: 'Pit', align: 'center', width: '45px', sortValue: r => r.isPit ? 1 : 0,
      render: r => r.isPit ? <span className="text-racing-blue">PIT</span> : null },
  ], [driver.bestLapTime, bestS1, bestS2, bestS3]);

  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-racing-muted mb-3">Lap Details</h4>
      <SortableTable<LapData>
        columns={columns}
        data={driver.laps}
        rowKey={r => String(r.num)}
        rowClass={r => r.lapTime !== null && r.lapTime === driver.bestLapTime ? 'bg-racing-green/[0.04]' : ''}
      />
    </div>
  );
}

function SessionDetail({ file, session, driver }: { file: RaceFile; session: SessionData; driver: DriverResult }) {
  const [expanded, setExpanded] = useState(false);

  const lapsWithTime = driver.laps.filter(l => l.lapTime && l.lapTime > 0);

  const lapChartData = lapsWithTime.map(l => ({
    lap: l.num,
    time: l.lapTime,
    s1: l.sector1,
    s2: l.sector2,
    s3: l.sector3,
  }));

  const tireData = driver.laps.filter(l => l.tireWear.fl > 0).map(l => ({
    lap: l.num,
    FL: +(l.tireWear.fl * 100).toFixed(1),
    FR: +(l.tireWear.fr * 100).toFixed(1),
    RL: +(l.tireWear.rl * 100).toFixed(1),
    RR: +(l.tireWear.rr * 100).toFixed(1),
  }));

  const fuelData = driver.laps.filter(l => l.fuel > 0).map(l => ({
    lap: l.num,
    fuel: +(l.fuel * 100).toFixed(1),
    used: +(l.fuelUsed * 100).toFixed(2),
  }));

  return (
    <div className="bg-racing-card border border-racing-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 grid hover:bg-racing-highlight/20 transition-colors cursor-pointer"
        style={{ gridTemplateColumns: '72px minmax(0, 200px) 55px minmax(0, 1fr) 85px 55px 130px 30px 20px', alignItems: 'center', gap: '8px' }}
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
        {expanded ? <ChevronUp className="w-4 h-4 text-racing-muted" /> : <ChevronDown className="w-4 h-4 text-racing-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-racing-border p-4 space-y-6">
          {/* Session Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-racing-muted">Team:</span> <span className="text-white">{driver.teamName}</span></div>
            <div><span className="text-racing-muted">Car #:</span> <span className="text-white">{driver.carNumber}</span></div>
            <div><span className="text-racing-muted">Pitstops:</span> <span className="text-white">{driver.pitstops}</span></div>
            <div><span className="text-racing-muted">Status:</span> <span className="text-white">{driver.finishStatus}</span></div>
            {driver.controlAndAids && (
              <div className="col-span-2">
                <span className="text-racing-muted">Aids:</span>{' '}
                <span className="text-racing-muted/70 text-xs">{driver.controlAndAids}</span>
              </div>
            )}
          </div>

          {/* Incidents for this driver */}
          {(() => {
            const driverIncidents = session.incidents.filter(
              i => i.driver1 === driver.name || i.description.includes(driver.name)
            );
            if (driverIncidents.length === 0) return null;
            return (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-racing-orange mb-2">
                  Incidents ({driverIncidents.length})
                </h4>
                <table className="w-full text-xs">
                  <colgroup>
                    <col style={{ width: '70px' }} />
                    <col />
                    <col style={{ width: '60px' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-racing-muted/50 text-left">
                      <th className="px-3 py-1 font-normal">Time</th>
                      <th className="px-3 py-1 font-normal">Description</th>
                      <th className="px-3 py-1 font-normal text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverIncidents.map((inc, i) => (
                      <tr key={i} className="border-t border-racing-orange/10 bg-racing-orange/[0.03]">
                        <td className="px-3 py-1.5 text-racing-muted font-mono">{formatEventTime(inc.time)}</td>
                        <td className="px-3 py-1.5 text-racing-text">{inc.description}</td>
                        <td className="px-3 py-1.5 text-racing-orange font-mono text-right">{inc.severity > 0 ? inc.severity : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Penalties for this driver */}
          {(() => {
            const driverPenalties = session.penalties.filter(p => p.driver === driver.name);
            if (driverPenalties.length === 0) return null;
            return (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-racing-red mb-2">
                  Penalties ({driverPenalties.length})
                </h4>
                <table className="w-full text-xs">
                  <colgroup>
                    <col style={{ width: '70px' }} />
                    <col style={{ width: '120px' }} />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-racing-muted/50 text-left">
                      <th className="px-3 py-1 font-normal">Time</th>
                      <th className="px-3 py-1 font-normal">Type</th>
                      <th className="px-3 py-1 font-normal">Reason</th>
                      <th className="px-3 py-1 font-normal">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverPenalties.map((pen, i) => (
                      <tr key={i} className="border-t border-racing-red/10 bg-racing-red/[0.03]">
                        <td className="px-3 py-1.5 text-racing-muted font-mono">{formatEventTime(pen.time)}</td>
                        <td className="px-3 py-1.5 text-racing-red font-medium">{pen.type}</td>
                        <td className="px-3 py-1.5 text-racing-text">{pen.reason}</td>
                        <td className="px-3 py-1.5 text-racing-muted/70">{pen.description !== pen.reason ? pen.description : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Track Limits for this driver */}
          {(() => {
            const driverTL = session.trackLimits.filter(tl => tl.driver === driver.name);
            if (driverTL.length === 0) return null;
            return (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-racing-yellow mb-2">
                  Track Limits ({driverTL.length})
                </h4>
                <table className="w-full text-xs">
                  <colgroup>
                    <col style={{ width: '70px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '80px' }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-racing-muted/50 text-left">
                      <th className="px-3 py-1 font-normal">Time</th>
                      <th className="px-3 py-1 font-normal text-right">Lap</th>
                      <th className="px-3 py-1 font-normal text-right">Points</th>
                      <th className="px-3 py-1 font-normal">Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverTL.map((tl, i) => (
                      <tr key={i} className="border-t border-racing-yellow/10 bg-racing-yellow/[0.03]">
                        <td className="px-3 py-1.5 text-racing-muted font-mono">{formatEventTime(tl.time)}</td>
                        <td className="px-3 py-1.5 text-racing-text text-right">{tl.lap}</td>
                        <td className="px-3 py-1.5 text-racing-yellow font-mono text-right">{tl.currentPoints}</td>
                        <td className="px-3 py-1.5 text-racing-muted/70">{tl.resolution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Lap Times Chart */}
          {lapChartData.length > 1 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-racing-muted mb-3">Lap Times</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lapChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: 'Lap', fill: '#6b7280', fontSize: 11, position: 'bottom' }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => formatLapTime(v)} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v: unknown) => formatLapTime(v as number)}
                  />
                  <Line type="monotone" dataKey="time" stroke="#e10600" strokeWidth={2} dot={{ fill: '#e10600', r: 3 }} name="Lap Time" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sector Times Chart */}
          {lapChartData.some(d => d.s1 && d.s2 && d.s3) && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-racing-muted mb-3">Sector Times</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lapChartData.filter(d => d.s1 && d.s2 && d.s3)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => `${Number(v).toFixed(3)}s`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="s1" fill="#9c27b0" name="S1" stackId="a" />
                  <Bar dataKey="s2" fill="#2196f3" name="S2" stackId="a" />
                  <Bar dataKey="s3" fill="#ff6d00" name="S3" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tire Wear Chart */}
          {tireData.length > 1 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-racing-muted mb-3">Tire Wear (%)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={tireData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => `${v}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="FL" stroke="#e10600" strokeWidth={1.5} dot={false} name="Front Left" />
                  <Line type="monotone" dataKey="FR" stroke="#ff6d00" strokeWidth={1.5} dot={false} name="Front Right" />
                  <Line type="monotone" dataKey="RL" stroke="#2196f3" strokeWidth={1.5} dot={false} name="Rear Left" />
                  <Line type="monotone" dataKey="RR" stroke="#00c853" strokeWidth={1.5} dot={false} name="Rear Right" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fuel Chart */}
          {fuelData.length > 1 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-racing-muted mb-3">Fuel Level (%)</h4>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={fuelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => `${v}%`}
                  />
                  <Line type="monotone" dataKey="fuel" stroke="#ffd600" strokeWidth={2} dot={false} name="Fuel %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lap Table */}
          <LapDetailsTable driver={driver} />
        </div>
      )}
    </div>
  );
}

export function SessionsView({ files, driverNames }: SessionsViewProps) {
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTrack, setFilterTrack] = useState<string>('All');

  const allSessions = getDriverSessions(files, driverNames);
  const tracks = Array.from(new Set(allSessions.map(s => s.file.trackVenue))).sort();

  const filtered = allSessions
    .filter(s => filterType === 'All' || s.session.type === filterType)
    .filter(s => filterTrack === 'All' || s.file.trackVenue === filterTrack)
    .sort((a, b) => b.file.timeString.localeCompare(a.file.timeString));

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
        />
      ))}
    </div>
  );
}
