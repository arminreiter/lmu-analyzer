import { clearAll } from '../lib/storage';

/**
 * Last resort when the app can't render — usually bad cached data, so offer to drop it.
 * The overlay window passes offerClear={false}: wiping storage there would pull it from under the main window.
 */
export function AppCrashed({ offerClear = true }: { offerClear?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-racing-black px-4">
      <div className="data-card carbon-fiber p-6 max-w-md text-center space-y-4">
        <h1 className="font-racing text-lg font-bold text-white tracking-wider">SOMETHING WENT WRONG</h1>
        <p className="text-sm text-racing-muted">
          {offerClear
            ? 'The app couldn\'t show your data. Clearing it usually fixes this: that removes the cached results, filters, excluded sessions, profile and settings — session notes and the theme are kept.'
            : 'The overlay couldn\'t show your data. Reload it, or fix the data in the main window.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-racing-border text-racing-muted hover:text-white transition-colors cursor-pointer">
            Reload
          </button>
          {offerClear && (
            <button onClick={() => { clearAll().finally(() => window.location.reload()); }}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-racing-red text-[#fff] hover:bg-racing-red/80 transition-colors cursor-pointer">
              Clear data and reload
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
