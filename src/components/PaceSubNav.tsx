import type { ReactNode } from 'react';

const TABS = [
  { id: 'benchmarks', label: 'Overview' },
  { id: 'trackmode', label: 'Per Track' },
] as const;

const TAB_BASE = 'px-5 py-2 text-xs font-medium tracking-[0.08em] uppercase whitespace-nowrap border-b-2 -mb-px';

interface PaceSubNavProps {
  active: (typeof TABS)[number]['id'];
  onViewChange?: (view: string) => void;
  /** Extra controls rendered after the tabs (e.g. track selector) */
  children?: ReactNode;
}

/** Overview / Per-Track tab bar shared by RacePaceView and TrackModeView */
export function PaceSubNav({ active, onViewChange, children }: PaceSubNavProps) {
  return (
    <div className="flex items-center gap-0 border-b border-racing-border/30">
      {TABS.map(tab =>
        tab.id === active ? (
          <span key={tab.id} className={`${TAB_BASE} border-racing-red text-white`}>
            {tab.label}
          </span>
        ) : (
          onViewChange && (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`${TAB_BASE} border-transparent text-racing-muted hover:text-racing-text transition-all cursor-pointer`}
            >
              {tab.label}
            </button>
          )
        ),
      )}
      {children}
    </div>
  );
}
