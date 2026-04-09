import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
}

export function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  return (
    <div className="data-card racing-stripe carbon-fiber p-4 group h-full">
      <div className="flex items-start justify-between mb-2 pl-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-racing-muted">{label}</span>
        {icon && <span className="text-racing-muted/50 group-hover:text-racing-red/60 transition-colors">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight pl-2 ${accent ?? 'text-white'}`}>
        {value}
      </div>
      {sub && <p className="text-racing-muted text-[11px] mt-1 font-mono pl-2">{sub}</p>}
    </div>
  );
}
