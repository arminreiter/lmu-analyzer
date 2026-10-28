import { createContext, useCallback, useContext } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, ImageDown } from 'lucide-react';
import type { MenuItem } from '../components/ContextMenu';
import { sessionKey } from './analytics';
import { errorMessage, formatLapTime } from './formatting';
import { buildSessionContext } from './sessionContext';
import { downloadShareCard, type ShareCardData } from './shareCard';

/** App-level session actions, so any table can offer them on right-click without prop drilling */
export interface SessionActions {
  onNavigate: (view: string, context?: string) => void;
  excludedIds: Set<string>;
  toggleExcluded: (key: string) => void;
}

export const SessionActionsContext = createContext<SessionActions | null>(null);

/** Where action failures are reported (the menu is gone by then): app notices, or the shared view's status line */
export const NotifyContext = createContext<(message: string) => void>(message => console.warn(message));

export interface SessionRef {
  fileName: string;
  sessionIndex: number;
  driverName: string;
  lapTime?: number | null;
  /** The row belongs to the session already on screen — no "Open session" */
  current?: boolean;
  /** Offer a share image for this row */
  card?: () => ShareCardData;
}

const ICON = 'w-3.5 h-3.5';

/** Run a menu action and report a failure. Runs synchronously in the click so the browser still
 *  sees the user gesture (Safari's clipboard needs it); sync throws and rejections both get reported. */
function attempt(notify: (message: string) => void, what: string, run: () => Promise<unknown>) {
  return () => {
    const fail = (e: unknown) => notify(`${what} failed: ${errorMessage(e)}`);
    try {
      run().catch(fail);
    } catch (e) {
      fail(e);
    }
  };
}

/** Builds the right-click items for a row that points at a session (and optionally a lap) */
export function useSessionMenu(): (ref: SessionRef) => MenuItem[] {
  const actions = useContext(SessionActionsContext);
  const notify = useContext(NotifyContext);
  return useCallback((ref: SessionRef) => {
    const items: MenuItem[] = [];
    if (actions && !ref.current) {
      items.push({ label: 'Open session', icon: <ExternalLink className={ICON} />,
        onClick: () => actions.onNavigate('session', buildSessionContext(ref.fileName, ref.sessionIndex, ref.driverName)) });
    }
    if (ref.lapTime) {
      const time = formatLapTime(ref.lapTime);
      items.push({ label: `Copy lap time (${time})`, icon: <Copy className={ICON} />,
        onClick: attempt(notify, 'Copying the lap time', () => {
          if (!navigator.clipboard) throw new Error('clipboard not available');
          return navigator.clipboard.writeText(time);
        }) });
    }
    if (ref.card) {
      const card = ref.card;
      items.push({ label: 'Download share image', icon: <ImageDown className={ICON} />,
        onClick: attempt(notify, 'Creating the share image', () => downloadShareCard(card())) });
    }
    if (actions) {
      const key = sessionKey(ref.fileName, ref.sessionIndex);
      items.push(actions.excludedIds.has(key)
        ? { label: 'Include session in stats', icon: <Eye className={ICON} />, className: 'text-racing-orange', onClick: () => actions.toggleExcluded(key) }
        : { label: 'Exclude session from stats', icon: <EyeOff className={ICON} />, onClick: () => actions.toggleExcluded(key) });
    }
    return items;
  }, [actions, notify]);
}
