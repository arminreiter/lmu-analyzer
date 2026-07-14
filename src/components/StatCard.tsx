import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
  /** 'default': dashboard card with racing stripe; 'tile': compact profile tile; 'center': centered race stat */
  variant?: 'default' | 'tile' | 'center';
}

export function StatCard({ label, value, sub, icon, accent, variant = 'default' }: StatCardProps) {
  if (variant === 'center') {
    return (
      <div className="data-card carbon-fiber p-4 text-center">
        <p className="text-racing-muted text-xs uppercase">{label}</p>
        <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      </div>
    );
  }

  const tile = variant === 'tile';
  return (
    <div className={`data-card carbon-fiber p-4 group ${tile ? '' : 'racing-stripe h-full'}`}>
      <div className={`flex justify-between ${tile ? 'items-center mb-1.5' : 'items-start mb-2 pl-2'}`}>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-racing-muted">{label}</span>
        {icon && <span className={`${tile ? 'text-racing-muted/40' : 'text-racing-muted/50'} group-hover:text-racing-red/60 transition-colors`}>{icon}</span>}
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${tile ? '' : 'pl-2'} ${accent ?? 'text-white'}`}>
        {value}
      </div>
      {sub && <p className={`text-racing-muted font-mono ${tile ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1 pl-2'}`}>{sub}</p>}
    </div>
  );
}
