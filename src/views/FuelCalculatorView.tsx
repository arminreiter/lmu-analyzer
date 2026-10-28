import { memo, useCallback, useMemo, useState } from 'react';
import { Fuel, Zap, Flag, Wrench } from 'lucide-react';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SearchableSelect } from '../components/SearchableSelect';
import { SortableTable, type Column } from '../components/SortableTable';
import { StatCard } from '../components/StatCard';
import { trackOption } from '../lib/racepace';
import { formatLapTime } from '../lib/formatting';
import { useDataIndex } from '../lib/useDataIndex';
import { cleanLapTimes, lapsForMinutes, median, planFuel, usageLaps, usageMedians, type FuelPlan } from '../lib/stints';

type Length = 'minutes' | 'laps';
type PlanStint = FuelPlan['stints'][number] & { index: number };

// Decimal keyboards in many locales type a comma ("2,5", "1:58,4")
const decimal = (v: string) => v.trim().replace(',', '.');

/** "1:58.432" or "118.432" → seconds */
function parseLapTime(v: string): number | null {
  const m = decimal(v).match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null;
}

const num = (v: string) => (decimal(v) === '' || isNaN(Number(decimal(v))) ? null : Number(decimal(v)));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// Reads the selected drivers' sessions from the data index, so it needs no props
export const FuelCalculatorView = memo(function FuelCalculatorView() {
  const { driverSessions } = useDataIndex();

  // Newest session the measurement can use: logged fuel (practice often runs without) at 1x fuel rate
  const newestWithFuel = useCallback((track?: string) => driverSessions
    .filter(s => (!track || s.file.trackCourse === track) && s.file.fuelMult === 1 && s.driver.laps.some(l => l.fuelUsed > 0))
    .reduce<(typeof driverSessions)[number] | null>((best, s) => (!best || s.file.timeString > best.file.timeString ? s : best), null),
  [driverSessions]);
  const latest = useMemo(() => newestWithFuel(), [newestWithFuel]);
  const [pickedTrack, setTrack] = useState<string | null>(null);
  const [pickedCar, setCar] = useState<string | null>(null);

  const tracks = useMemo(() => Array.from(new Set(driverSessions.map(s => s.file.trackCourse))).sort(), [driverSessions]);
  // A pick that the driver/class filters no longer offer falls back to the newest fuel session
  const track = pickedTrack && tracks.includes(pickedTrack) ? pickedTrack : latest?.file.trackCourse ?? tracks[0] ?? '';
  const cars = useMemo(() => Array.from(new Set(driverSessions.filter(s => s.file.trackCourse === track).map(s => s.driver.carType))).sort(),
    [driverSessions, track]);
  const car = pickedCar && cars.includes(pickedCar) ? pickedCar : newestWithFuel(track)?.driver.carType ?? cars[0] ?? '';

  // Your measured usage at this track in this car.
  // ponytail: only 1x fuel-rate sessions — whether LMU's fuel rate also scales VE is unverified, so don't normalize
  const measured = useMemo(() => {
    const sessions = driverSessions.filter(s => s.file.trackCourse === track && s.driver.carType === car && s.file.fuelMult === 1);
    const usable = sessions.flatMap(s => usageLaps(s.driver.laps));
    return {
      sessions: sessions.filter(s => s.driver.laps.some(l => l.fuelUsed > 0)).length,
      laps: usable.filter(l => l.fuelUsed > 0).length,
      ...usageMedians(usable),
      lapTime: median(sessions.flatMap(s => cleanLapTimes(s.driver.laps))),
    };
  }, [driverSessions, track, car]);

  const [length, setLength] = useState<Length>('minutes');
  const [raceLength, setRaceLength] = useState('60');
  const [rate, setRate] = useState('1');
  const [margin, setMargin] = useState('1');
  // Values typed over the measured ones, remembered for the track+car they were typed for — when the
  // combo changes (a pick, or the driver/class filters), the new combo's measured values show again
  const combo = `${track}|${car}`;
  const [overrides, setOverrides] = useState<{ combo: string; lapTime?: string; fuel?: string; ve?: string }>({ combo: '' });
  const own = overrides.combo === combo ? overrides : { combo };
  const override = (field: 'lapTime' | 'fuel' | 've', value: string) => setOverrides({ ...own, [field]: value });

  const pick = (t: string, c: string | null) => {
    setTrack(t);
    setCar(c);
  };

  const lapTimeText = own.lapTime ?? (measured.lapTime ? formatLapTime(measured.lapTime) : '');
  const fuelText = own.fuel ?? (measured.fuel ? (measured.fuel * 100).toFixed(2) : '');
  const veText = own.ve ?? (measured.ve ? (measured.ve * 100).toFixed(2) : '');

  const lapTime = parseLapTime(lapTimeText);
  const fuelRate = num(rate) ?? 1;
  const raceLaps = length === 'laps'
    ? Math.ceil(num(raceLength) ?? 0)
    : lapTime ? lapsForMinutes(num(raceLength) ?? 0, lapTime) : 0;
  const plan = planFuel({
    raceLaps,
    fuelPerLap: ((num(fuelText) ?? 0) / 100) * fuelRate,
    vePerLap: ((num(veText) ?? 0) / 100) * fuelRate,
    marginLaps: Math.max(0, num(margin) ?? 0),
  });

  const stintRows: PlanStint[] = plan?.stints.map((s, index) => ({ ...s, index })) ?? [];
  const columns: Column<PlanStint>[] = [
    { key: 'stint', label: 'Stint', width: '60px', render: r => <span className="text-white font-bold">{r.index + 1}</span> },
    { key: 'laps', label: 'Laps', width: '130px', render: r => <span className="font-mono text-racing-muted">L{r.startLap}–{r.endLap} <span className="text-racing-muted/50">({r.endLap - r.startLap + 1})</span></span> },
    { key: 'fuel', label: 'Fuel needed', align: 'right', mono: true, render: r => <span className="text-racing-yellow">{pct(r.fuel)}</span> },
    { key: 've', label: 'VE needed', align: 'right', mono: true, render: r => <span className="text-racing-yellow/80">{plan && plan.totalVe > 0 ? pct(r.ve) : '--'}</span> },
    { key: 'when', label: '', align: 'right', render: r => <span className="text-racing-muted text-xs">{r.index === 0 ? 'start' : `pit end of L${r.startLap - 1}`}</span> },
  ];

  const field = 'w-full bg-racing-card border border-racing-border rounded px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-racing-red/60';
  const label = 'block text-racing-muted text-[10px] uppercase tracking-wider mb-1';

  if (tracks.length === 0) {
    return <div className="text-center py-20 text-racing-muted">No sessions to measure fuel use from.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <SearchableSelect value={track} options={tracks.map(trackOption)}
          onChange={t => pick(t, null)} placeholder="Track" />
        <SearchableSelect value={car} options={cars.map(c => ({ value: c, label: c }))} onChange={c => pick(track, c)} placeholder="Car" />
        <span className="text-racing-muted text-xs">
          {measured.laps > 0 ? `Measured from ${measured.laps} laps in ${measured.sessions} session${measured.sessions === 1 ? '' : 's'}` : 'No fuel use recorded for this track and car — enter your own values'}
        </span>
      </div>

      <div className="data-card carbon-fiber p-5">
        <h3 className="text-xs uppercase tracking-wider text-racing-muted mb-3 font-medium">Race</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
          <div className="col-span-2 md:col-span-1">
            <span className={label}>Length</span>
            <FilterButtonGroup options={[{ value: 'minutes', label: 'Minutes' }, { value: 'laps', label: 'Laps' }]} value={length} onChange={setLength} />
          </div>
          <label>
            <span className={label}>{length === 'minutes' ? 'Minutes' : 'Laps'}</span>
            <input className={field} inputMode="decimal" value={raceLength} onChange={e => setRaceLength(e.target.value)} />
          </label>
          <label>
            <span className={label}>Lap time</span>
            <input className={field} placeholder="1:58.400" value={lapTimeText} onChange={e => override('lapTime', e.target.value)} />
          </label>
          <label>
            <span className={label}>Fuel / lap (%)</span>
            <input className={field} inputMode="decimal" value={fuelText} onChange={e => override('fuel', e.target.value)} />
          </label>
          <label>
            <span className={label}>VE / lap (%)</span>
            <input className={field} inputMode="decimal" placeholder="no VE" value={veText} onChange={e => override('ve', e.target.value)} />
          </label>
          <label title="Server fuel usage multiplier — applied to fuel and VE">
            <span className={label}>Fuel rate (x)</span>
            <input className={field} inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
          </label>
          <label title="Extra laps of fuel/VE carried in every stint">
            <span className={label}>Margin (laps)</span>
            <input className={field} inputMode="decimal" value={margin} onChange={e => setMargin(e.target.value)} />
          </label>
        </div>
      </div>

      {plan ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Race laps" value={raceLaps} sub={length === 'minutes' ? 'incl. the lap after the clock' : undefined} icon={<Flag className="w-4 h-4" />} />
            <StatCard label="Pit stops" value={plan.stops} sub={`${plan.lapsPerStint} laps per stint`} icon={<Wrench className="w-4 h-4" />} accent="text-racing-red" />
            <StatCard label="Total fuel" value={pct(plan.totalFuel)} sub={`of a tank${plan.limitedBy === 'fuel' ? ' · limiting' : ''}`} icon={<Fuel className="w-4 h-4" />} accent="text-racing-yellow" />
            <StatCard label="Total VE" value={plan.totalVe > 0 ? pct(plan.totalVe) : '--'} sub={plan.totalVe > 0 ? `of full VE${plan.limitedBy === 've' ? ' · limiting' : ''}` : 'car has no VE limit'} icon={<Zap className="w-4 h-4" />} accent="text-racing-yellow" />
          </div>
          <div className="data-card carbon-fiber overflow-hidden">
            <DataCardHeader title="STINT PLAN">
              <span className="ml-auto text-[10px] font-mono text-racing-muted/50">stopping as late as {plan.limitedBy === 've' ? 'VE' : 'fuel'} allows, margin included</span>
            </DataCardHeader>
            <SortableTable<PlanStint> columns={columns} data={stintRows} rowKey={r => String(r.index)} />
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-racing-muted text-sm">
          Enter a race length, lap time and fuel use per lap{num(margin) && num(fuelText) ? ' — or the margin is larger than a full tank lasts' : ''}.
        </div>
      )}
    </div>
  );
});
