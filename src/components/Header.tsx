import { FolderOpen, User, Layers, RefreshCw, Gauge, Download, Sun, Moon } from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import type { DriverSummary, CarClass } from '../lib/types';
import { CLASS_SPEED_ORDER } from '../lib/analytics';
import { getClassColor } from '../lib/formatting';
import { useInstallPrompt } from '../lib/useInstallPrompt';

interface HeaderProps {
  selectedDrivers: string[];
  drivers: DriverSummary[];
  playerDrivers: string[];
  onDriverChange: (names: string[]) => void;
  selectedClasses: CarClass[];
  onClassChange: (classes: CarClass[]) => void;
  onReload: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  activeView: string;
  onViewChange: (view: string) => void;
  racePaceEnabled: boolean;
  onToggleRacePace: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bests', label: 'Personal Bests' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'cars', label: 'Cars' },
  { id: 'races', label: 'Race Results' },
  { id: 'profile', label: 'Driver Profile' },
  { id: 'benchmarks', label: 'Benchmark Times' },
  { id: 'about', label: 'About' },
];

export function Header({ selectedDrivers, drivers, playerDrivers, onDriverChange, selectedClasses, onClassChange, onReload, onRefresh, refreshing, activeView, onViewChange, racePaceEnabled, onToggleRacePace, theme, onToggleTheme }: HeaderProps) {
  const { canInstall, install } = useInstallPrompt();
  const driverOptions = drivers.map(d => ({
    value: d.name,
    label: d.name,
    badge: d.isPlayer ? <span className="w-1.5 h-1.5 bg-racing-green rounded-full shrink-0" /> : undefined,
    detail: `${d.sessionCount}s / ${d.totalLaps}L`,
  }));

  const classOptions = CLASS_SPEED_ORDER.map(c => ({
    value: c,
    label: c,
    badge: <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: getClassColor(c) }} />,
  }));

  return (
    <header className="bg-racing-dark/95 backdrop-blur-md border-b border-racing-border sticky top-0 z-50">
      <div className="h-[2px] bg-gradient-to-r from-racing-red via-racing-red/60 to-racing-red/10" />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-racing-red flex items-center justify-center"
              style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
              <span className="font-racing text-[9px] font-black text-[#fff] tracking-wider">LMU</span>
            </div>
            <span className="font-racing text-xs font-bold text-white tracking-[0.15em] hidden sm:block">
              ANALYZER
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Class filter */}
            <SearchableMultiSelect
              values={selectedClasses}
              options={classOptions}
              onChange={v => onClassChange(v as CarClass[])}
              placeholder="All classes"
              icon={<Layers className="w-3.5 h-3.5 text-racing-muted" />}
            />

            {/* Driver filter */}
            <SearchableMultiSelect
              values={selectedDrivers}
              options={driverOptions}
              onChange={onDriverChange}
              placeholder="Select drivers..."
              icon={<User className="w-3.5 h-3.5 text-racing-muted" />}
              sortSelectedFirst
              quickActions={[{
                label: 'My profiles',
                onSelect: () => onDriverChange(playerDrivers),
              }]}
            />

            <button
              onClick={onToggleRacePace}
              className={`p-2 transition-colors cursor-pointer ${racePaceEnabled ? 'text-racing-green' : 'text-racing-muted/50 hover:text-racing-green'}`}
              title={racePaceEnabled ? 'Disable benchmark times' : 'Enable benchmark times (ohne_speed)'}
            >
              <Gauge className="w-3.5 h-3.5" />
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2 text-racing-muted/50 hover:text-racing-green disabled:opacity-50 transition-colors cursor-pointer"
                title="Refresh data from folder"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={onToggleTheme}
              className="p-2 text-racing-muted/50 hover:text-racing-yellow transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onReload}
              className="p-2 text-racing-muted/50 hover:text-racing-red transition-colors cursor-pointer"
              title="Change folder"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            {canInstall && (
              <button
                onClick={install}
                className="p-2 text-racing-muted/50 hover:text-racing-green transition-colors cursor-pointer"
                title="Install app"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-none">
          {VIEWS.map(v => {
            if (v.id === 'benchmarks' && !racePaceEnabled) return null;
            const isActive = v.id === 'benchmarks'
              ? activeView === 'benchmarks' || activeView === 'trackmode'
              : activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                className={`nav-tab relative px-5 py-2.5 text-xs font-medium tracking-[0.08em] uppercase whitespace-nowrap transition-all cursor-pointer
                  ${isActive
                    ? 'nav-tab-active text-white font-semibold'
                    : 'text-racing-muted hover:text-racing-text hover:bg-white/[0.02]'
                  }`}
              >
                {v.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
