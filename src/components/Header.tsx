import { FolderOpen, User, Layers, RefreshCw } from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import type { DriverSummary, CarClass } from '../lib/types';
import { getClassColor } from '../lib/analytics';

interface HeaderProps {
  selectedDrivers: string[];
  drivers: DriverSummary[];
  onDriverChange: (names: string[]) => void;
  allClasses: CarClass[];
  selectedClasses: CarClass[];
  onClassChange: (classes: CarClass[]) => void;
  onReload: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  activeView: string;
  onViewChange: (view: string) => void;
}

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bests', label: 'Personal Bests' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'cars', label: 'Cars' },
  { id: 'races', label: 'Race Results' },
];

export function Header({ selectedDrivers, drivers, onDriverChange, allClasses, selectedClasses, onClassChange, onReload, onRefresh, refreshing, activeView, onViewChange }: HeaderProps) {
  const driverOptions = drivers.map(d => ({
    value: d.name,
    label: d.name,
    badge: d.isPlayer ? <span className="w-1.5 h-1.5 bg-racing-green rounded-full shrink-0" /> : undefined,
    detail: `${d.sessionCount}s / ${d.totalLaps}L`,
  }));

  const classOptions = allClasses.map(c => ({
    value: c,
    label: c,
    badge: <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: getClassColor(c) }} />,
  }));

  return (
    <header className="bg-racing-dark/95 backdrop-blur-md border-b border-racing-border sticky top-0 z-50">
      <div className="h-[2px] bg-gradient-to-r from-racing-red via-racing-red/50 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-racing-red rounded flex items-center justify-center">
              <span className="font-racing text-[9px] font-black text-white tracking-wider">LMU</span>
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
            />

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
              onClick={onReload}
              className="p-2 text-racing-muted/50 hover:text-racing-red transition-colors cursor-pointer"
              title="Change folder"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <nav className="flex gap-0.5 -mb-px overflow-x-auto scrollbar-none">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`relative px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap transition-all cursor-pointer
                ${activeView === v.id
                  ? 'text-white'
                  : 'text-racing-muted hover:text-racing-text'
                }`}
            >
              {v.label}
              {activeView === v.id && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-racing-red rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
