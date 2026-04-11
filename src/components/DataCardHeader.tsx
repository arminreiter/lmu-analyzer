import type { ReactNode } from 'react';

interface DataCardHeaderProps {
  title: ReactNode;
  children?: ReactNode;
}

export function DataCardHeader({ title, children }: DataCardHeaderProps) {
  return (
    <div className="px-5 py-3 border-b border-racing-border flex items-center checkered">
      <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">{title}</h3>
      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}
