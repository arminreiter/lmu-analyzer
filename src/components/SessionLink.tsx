import type { ReactNode } from 'react';
import { buildSessionContext } from '../lib/sessionContext';

interface SessionLinkProps {
  fileName: string;
  sessionIndex: number;
  driverName: string;
  onNavigate: (view: string, context?: string) => void;
  children: ReactNode;
}

export function SessionLink({ fileName, sessionIndex, driverName, onNavigate, children }: SessionLinkProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate('session', buildSessionContext(fileName, sessionIndex, driverName)); }}
      className="text-racing-muted text-xs hover:text-racing-red transition-colors cursor-pointer underline decoration-racing-muted/30 hover:decoration-racing-red"
    >
      {children}
    </button>
  );
}
