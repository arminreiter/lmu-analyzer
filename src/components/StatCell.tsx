import type { ReactNode } from 'react';

interface StatCellProps {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  /** Custom value markup — replaces the default white value line. */
  children?: ReactNode;
}

/** Label/value cell used inside summary grids (Tracks/Cars per-item stats). */
export function StatCell({ label, value, mono, children }: StatCellProps) {
  return (
    <div>
      <p className="text-racing-muted text-xs uppercase">{label}</p>
      {children ?? <p className={`text-white text-lg font-bold${mono ? ' font-mono' : ''}`}>{value}</p>}
    </div>
  );
}

export function LapValidityCell({ valid, invalid }: { valid: number; invalid: number }) {
  return (
    <StatCell label="Valid / Invalid">
      <p className="text-lg font-bold">
        <span className="text-racing-green">{valid}</span>
        <span className="text-racing-muted mx-1">/</span>
        <span className={invalid > 0 ? 'text-racing-muted' : 'text-racing-green'}>{invalid}</span>
      </p>
    </StatCell>
  );
}
