import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionDetailView } from './SessionDetailView';
import { parseShareLink, ShareTooLargeError, type SharedSession } from '../lib/shareLink';
import { Footer } from '../components/Footer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NotifyContext } from '../lib/sessionMenu';

function Broken({ tooLarge }: { tooLarge?: boolean }) {
  return (
    <div className="text-center py-20 text-racing-muted">
      {tooLarge ? 'This shared session is too large to open.' : 'This shared link is broken or incomplete.'}
    </div>
  );
}

/** A session someone shared via #shared/… — viewable without loading any data */
export function SharedSessionView({ encoded, onExit }: { encoded: string; onExit: () => void }) {
  const [shared, setShared] = useState<SharedSession | null>(null);
  const [failed, setFailed] = useState<'broken' | 'tooLarge' | null>(null);
  // No app notices here — action failures (copy, share image) show in the header for a few seconds
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | undefined>(undefined);
  const notify = useCallback((msg: string) => {
    setMessage(msg);
    clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(messageTimer.current), []);

  useEffect(() => {
    parseShareLink(encoded).then(setShared, e => setFailed(e instanceof ShareTooLargeError ? 'tooLarge' : 'broken'));
  }, [encoded]);

  return (
    <div className="min-h-screen flex flex-col bg-racing-black">
      <header className="bg-racing-dark/95 border-b border-racing-border">
        <div className="h-[2px] bg-gradient-to-r from-racing-red via-racing-red/60 to-racing-red/10" />
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-12 flex items-center justify-between gap-3">
          <span className="font-racing text-xs font-bold text-white tracking-[0.15em] truncate">LMU ANALYZER · SHARED SESSION</span>
          {message && <span className="text-xs text-racing-orange truncate">{message}</span>}
          <button onClick={onExit}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-racing-border text-racing-muted hover:text-white hover:bg-racing-highlight/20 transition-colors cursor-pointer whitespace-nowrap">
            Analyze your own races
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {failed ? <Broken tooLarge={failed === 'tooLarge'} /> : !shared ? (
          <div className="text-center py-20 text-racing-muted">Loading shared session…</div>
        ) : (
          // The payload comes from a URL anyone can craft — a render crash must not take the page down
          <ErrorBoundary fallback={<Broken />}>
            <NotifyContext.Provider value={notify}>
              <SessionDetailView file={shared.file} session={shared.session} driver={shared.driver} onBack={onExit} shared />
            </NotifyContext.Provider>
          </ErrorBoundary>
        )}
      </main>
      <Footer />
    </div>
  );
}
