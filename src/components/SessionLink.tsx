import type { ReactNode } from 'react';

interface SessionLinkProps {
  fileName: string;
  sessionIndex: number;
  onNavigate: (view: string, context?: string) => void;
  children: ReactNode;
}

export function SessionLink({ fileName, sessionIndex, onNavigate, children }: SessionLinkProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate('session', `${fileName}::${sessionIndex}`); }}
      className="text-racing-muted text-xs hover:text-racing-red transition-colors cursor-pointer underline decoration-racing-muted/30 hover:decoration-racing-red"
    >
      {children}
    </button>
  );
}
