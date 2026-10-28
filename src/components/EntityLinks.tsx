import { useContext, type ReactNode } from 'react';
import { SessionActionsContext } from '../lib/sessionMenu';
import { trackLabel } from '../lib/racepace';

interface LinkProps {
  className?: string;
  children?: ReactNode;
}

function EntityLink({ view, target, className = '', children }: LinkProps & { view: 'tracks' | 'cars'; target: string }) {
  const actions = useContext(SessionActionsContext);
  if (!actions) return <span className={className}>{children}</span>;
  return (
    <button
      onClick={e => { e.stopPropagation(); actions.onNavigate(view, target); }}
      title={view === 'tracks' ? 'Open track' : 'Open car'}
      className={`${className} text-left max-w-full truncate hover:text-racing-red transition-colors cursor-pointer`}>
      {children}
    </button>
  );
}

/** A track name that opens the Tracks view on that track */
export function TrackLink({ track, className, children }: LinkProps & { track: string }) {
  return <EntityLink view="tracks" target={track} className={className}>{children ?? trackLabel(track)}</EntityLink>;
}

/** A car name that opens the Cars view on that car */
export function CarLink({ car, className, children }: LinkProps & { car: string }) {
  return <EntityLink view="cars" target={car} className={className}>{children ?? car}</EntityLink>;
}
