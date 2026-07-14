import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { FolderPicker } from './components/FolderPicker';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OverviewView } from './views/OverviewView';
import { PersonalBestsView } from './views/PersonalBestsView';
import { SessionsView } from './views/SessionsView';
import { SessionDetailView } from './views/SessionDetailView';
import { TracksView } from './views/TracksView';
import { TrackModeView } from './views/TrackModeView';
import { CarsView } from './views/CarsView';
import { RaceResultsView } from './views/RaceResultsView';
import { DriverProfileView } from './views/DriverProfileView';
import { RacePaceView } from './views/RacePaceView';
import { AboutView } from './views/AboutView';
import { loadFolder, parseUploadedFiles } from './lib/parser';
import { getAllDrivers, detectPlayerDrivers, filterFilesByClasses, deduplicateSessions, CLASS_SPEED_ORDER } from './lib/analytics';
import { errorMessage } from './lib/formatting';
import { parseSessionContext } from './lib/sessionContext';
import { DataIndexProvider } from './lib/DataIndexContext';
import * as storage from './lib/storage';
import { useTheme } from './lib/useTheme';
import type { RaceFile, DriverSummary, CarClass } from './lib/types';

// Build a URL hash from view + context
const buildHash = (view: string, context: string | null) =>
  '#' + view + (context ? '/' + encodeURIComponent(context) : '');

// Short summary line for files that failed to parse
const LEGACY_CACHE_NOTICE =
  'Cached data was saved by an older app version — refresh from your folder or re-import your files for best results.';

const failedFilesNotice = (failed: string[]) =>
  `${failed.length} file${failed.length === 1 ? '' : 's'} could not be parsed and ${failed.length === 1 ? 'was' : 'were'} skipped: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ', …' : ''}`;

// Parse a URL hash back into view + context
const parseHash = (hash: string): { view: string; context: string | null } | null => {
  if (!hash || hash === '#') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const slash = raw.indexOf('/');
  if (slash === -1) return { view: raw, context: null };
  return { view: raw.slice(0, slash), context: decodeURIComponent(raw.slice(slash + 1)) };
};

function App() {
  const [files, setFiles] = useState<RaceFile[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [playerDrivers, setPlayerDrivers] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<CarClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking warning (skipped files, stale cache, caching failure) — dismissible toast
  const [notices, setNotices] = useState<string[]>([]);
  const addNotice = useCallback((msg: string) => {
    setNotices(prev => (prev.includes(msg) ? prev : [...prev, msg]));
  }, []);
  const dismissNotice = useCallback((msg: string) => {
    setNotices(prev => prev.filter(n => n !== msg));
  }, []);
  const [activeView, setActiveView] = useState('overview');
  const [viewContext, setViewContext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [racePaceEnabled, setRacePaceEnabled] = useState(() => {
    const v = storage.lsGet(storage.KEYS.benchmarks);
    return v === null || v === '1';
  });
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates every 5 minutes
      if (registration) {
        setInterval(() => registration.update(), 5 * 60 * 1000);
      }
    },
  });

  // Applies a parsed dataset to app state; returns the deduplicated array (or null if empty)
  // so callers can persist the deduplicated data instead of the raw parse.
  const applyParsedData = useCallback((rawParsed: RaceFile[], restoreFilters = false): RaceFile[] | null => {
    if (rawParsed.length === 0) {
      setError('No valid XML race files found.');
      setLoading(false);
      return null;
    }
    const parsed = deduplicateSessions(rawParsed);
    setFiles(parsed);
    const classes = CLASS_SPEED_ORDER;
    const allDriversList = getAllDrivers(parsed);
    setDrivers(allDriversList);
    const detected = detectPlayerDrivers(parsed);
    setPlayerDrivers(detected);

    const savedFilters = restoreFilters ? storage.loadFilters() : null;
    if (savedFilters) {
      // Restore saved filters, but only keep values that still exist in the data
      const validDrivers = savedFilters.selectedDrivers.filter(d => allDriversList.some(dl => dl.name === d));
      const validClasses = savedFilters.selectedClasses.filter(c => classes.includes(c));
      setSelectedDrivers(validDrivers.length > 0 ? validDrivers : detected);
      setSelectedClasses(validClasses.length > 0 ? validClasses : classes);
    } else {
      setSelectedClasses(classes);
      setSelectedDrivers(detected);
    }
    // URL hash wins over saved view so deep links / reloads land on the right view
    const fromHash = parseHash(window.location.hash);
    if (fromHash) {
      setActiveView(fromHash.view);
      setViewContext(fromHash.context);
    } else if (savedFilters) {
      setActiveView(savedFilters.activeView || 'overview');
    }
    setLoaded(true);
    return parsed;
  }, []);

  // Persist a dataset for resume; caching failure is non-fatal but worth surfacing
  const persistFiles = useCallback((parsed: RaceFile[]) => {
    storage.saveFiles(parsed).then(ok => {
      if (!ok) {
        console.warn('Failed to cache parsed files');
        addNotice('Could not cache your data — "Resume last session" will not be available.');
      }
    });
  }, [addNotice]);

  // Auto-restore cached data on mount
  useEffect(() => {
    (async () => {
      const [cached, handle] = await Promise.all([storage.loadCachedFiles(), storage.loadDirectoryHandle()]);
      if (!cached || cached.files.length === 0) return;
      setHasCachedData(true);
      applyParsedData(cached.files, true);
      let legacyCache = cached.legacy;
      // Directory handle enables the refresh button
      if (handle) {
        setDirHandle(handle);
        // If data came from a directory, try to re-read fresh data
        if (storage.loadDataSource() === 'directory') {
          try {
            // Permission not granted needs a user gesture (refresh button) — stay silent
            const perm = await handle.queryPermission({ mode: 'read' });
            if (perm === 'granted') {
              const { files: fresh, failedFiles } = await loadFolder(handle);
              const deduped = applyParsedData(fresh, true);
              if (deduped) {
                persistFiles(deduped);
                legacyCache = false; // fresh parse replaced the stale cache
              }
              if (failedFiles.length > 0) addNotice(failedFilesNotice(failedFiles));
            }
          } catch {
            addNotice('Showing cached data — folder could not be re-read.');
          }
        }
      }
      if (legacyCache) addNotice(LEGACY_CACHE_NOTICE);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist filters whenever they change (skip initial empty state)
  useEffect(() => {
    if (loaded) {
      storage.saveFilters(selectedDrivers, selectedClasses, activeView === 'session' ? 'sessions' : activeView);
    }
  }, [selectedDrivers, selectedClasses, activeView, loaded]);

  const handleFolderSelected = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    setDirHandle(handle);
    try {
      const { files: parsed, failedFiles } = await loadFolder(handle);
      const deduped = applyParsedData(parsed, true);
      if (deduped) {
        persistFiles(deduped);
        storage.saveDataSource('directory');
        storage.saveDirectoryHandle(handle);
      }
      if (failedFiles.length > 0) addNotice(failedFilesNotice(failedFiles));
    } catch (e) {
      setError(`Failed to load data: ${errorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData, persistFiles, addNotice]);

  const handleFilesUploaded = useCallback(async (uploadedFiles: File[]) => {
    setLoading(true);
    setError(null);
    setDirHandle(null);
    try {
      const { files: parsed, failedFiles } = await parseUploadedFiles(uploadedFiles);
      const deduped = applyParsedData(parsed, true);
      if (deduped) {
        persistFiles(deduped);
        storage.saveDataSource('upload');
        storage.clearDirectoryHandle();
      }
      if (failedFiles.length > 0) addNotice(failedFilesNotice(failedFiles));
    } catch (e) {
      setError(`Failed to load data: ${errorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData, persistFiles, addNotice]);

  const handleRefresh = useCallback(async () => {
    const handle = dirHandle;
    if (!handle) return;
    setLoading(true);
    setError(null);
    try {
      const perm = await handle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') {
        setError('Permission to read folder was denied.');
        setLoading(false);
        return;
      }
      const { files: parsed, failedFiles } = await loadFolder(handle);
      const deduped = applyParsedData(parsed, true);
      if (deduped) persistFiles(deduped);
      if (failedFiles.length > 0) addNotice(failedFilesNotice(failedFiles));
    } catch (e) {
      setError(`Failed to refresh data: ${errorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData, persistFiles, dirHandle, addNotice]);

  const handleResumeCached = useCallback(async () => {
    const cached = await storage.loadCachedFiles();
    if (!cached || cached.files.length === 0) return;
    applyParsedData(cached.files, true);
    if (cached.legacy) addNotice(LEGACY_CACHE_NOTICE);
    const handle = await storage.loadDirectoryHandle();
    if (handle) setDirHandle(handle);
  }, [applyParsedData, addNotice]);

  const handleReload = useCallback(() => {
    if (!window.confirm('This clears the cached data, filters, and your driver profile. Continue?')) return;
    setFiles([]);
    setDrivers([]);
    setSelectedDrivers([]);
    setSelectedClasses([]);
    setLoaded(false);
    setError(null);
    setNotices([]);
    storage.clearAll();
    setRacePaceEnabled(true); // matches the default when the cleared key is absent
    setDirHandle(null);
    setHasCachedData(false);
  }, []);

  const handleToggleRacePace = useCallback(() => {
    setRacePaceEnabled(prev => {
      const next = !prev;
      storage.lsSet(storage.KEYS.benchmarks, next ? '1' : '0');
      if (!next && activeView === 'benchmarks') setActiveView('overview');
      return next;
    });
  }, [activeView]);

  const isPoppingRef = useRef(false);

  // Push history entry when view changes (unless triggered by popstate)
  useEffect(() => {
    if (!loaded) return;
    if (isPoppingRef.current) {
      isPoppingRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const hash = buildHash(activeView, viewContext);
    const state = { view: activeView, context: viewContext };
    if (window.location.hash !== hash) {
      window.history.pushState(state, '', hash);
    } else if (!window.history.state) {
      window.history.replaceState(state, '', hash);
    }
  }, [activeView, viewContext, loaded]);

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = (e.state as { view: string; context: string | null } | null) ?? parseHash(window.location.hash);
      if (!state) return;
      isPoppingRef.current = true;
      setActiveView(state.view);
      setViewContext(state.context);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTo = useCallback((view: string, context?: string) => {
    setActiveView(view);
    setViewContext(context ?? null);
  }, []);

  const filteredFiles = useMemo(
    () => filterFilesByClasses(files, selectedClasses),
    [files, selectedClasses]
  );

  // Resolve session detail from viewContext "fileName::sessionIndex[::driverName]"
  const sessionDetail = useMemo(() => {
    if (activeView !== 'session' || !viewContext) return null;
    const { fileName, sessionIndex, driverName } = parseSessionContext(viewContext);
    const file = filteredFiles.find(f => f.fileName === fileName);
    if (!file) return null;
    const session = file.sessions.find(s => s.sessionIndex === sessionIndex);
    if (!session) return null;
    const driver = driverName
      ? session.drivers.find(d => d.name === driverName)
      : session.drivers.find(d => selectedDrivers.includes(d.name));
    if (!driver) return null;
    return { file, session, driver };
  }, [activeView, viewContext, filteredFiles, selectedDrivers]);

  const handleSessionBack = useCallback(() => {
    window.history.back();
  }, []);

  // One stacked container so update + warning toasts never overlap
  const toasts = (needRefresh || notices.length > 0) && (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {needRefresh && (
        <div className="flex items-center gap-3 bg-racing-card border border-racing-red/50 px-4 py-3 rounded-lg shadow-lg shadow-racing-red/20">
          <span className="text-sm text-racing-light">A new version is available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1 text-sm font-bold bg-racing-red text-white rounded hover:bg-racing-red/80 transition-colors"
          >
            Update
          </button>
        </div>
      )}
      {/* Non-blocking warnings (skipped files, stale cache, caching failure) */}
      {notices.map(msg => (
        <div key={msg} className="flex items-center gap-3 bg-racing-card border border-racing-yellow/50 px-4 py-3 rounded-lg shadow-lg">
          <span className="text-sm text-racing-light">{msg}</span>
          <button
            onClick={() => dismissNotice(msg)}
            className="px-3 py-1 text-sm font-bold bg-racing-yellow/20 text-racing-yellow rounded hover:bg-racing-yellow/30 transition-colors"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );


  if (!loaded) {
    return (
      <>
        <FolderPicker
          onFolderSelected={handleFolderSelected}
          onFilesUploaded={handleFilesUploaded}
          onResumeCached={hasCachedData ? handleResumeCached : undefined}
          loading={loading}
          error={error}
        />
        {toasts}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-racing-black">
      <Header
        selectedDrivers={selectedDrivers}
        drivers={drivers}
        playerDrivers={playerDrivers}
        onDriverChange={setSelectedDrivers}
        selectedClasses={selectedClasses}
        onClassChange={setSelectedClasses}
        onReload={handleReload}
        onRefresh={dirHandle ? handleRefresh : undefined}
        refreshing={loading}
        activeView={activeView === 'session' ? 'sessions' : activeView}
        onViewChange={(view: string) => { setActiveView(view); setViewContext(null); }}
        racePaceEnabled={racePaceEnabled}
        onToggleRacePace={handleToggleRacePace}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {activeView === 'about' ? (
          <AboutView />
        ) : selectedDrivers.length === 0 ? (
          <div className="text-center py-20 text-racing-muted">
            <p className="text-lg">No drivers selected</p>
            <p className="text-sm mt-1">Select at least one driver from the dropdown above.</p>
          </div>
        ) : (
          <DataIndexProvider files={filteredFiles} driverNames={selectedDrivers}>
            {activeView === 'overview' && <OverviewView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'bests' && <PersonalBestsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'sessions' && <SessionsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'session' && sessionDetail && (
              <SessionDetailView file={sessionDetail.file} session={sessionDetail.session} driver={sessionDetail.driver} onBack={handleSessionBack} />
            )}
            {activeView === 'tracks' && <TracksView files={filteredFiles} driverNames={selectedDrivers} initialTrack={viewContext} onNavigate={navigateTo} />}
            {activeView === 'cars' && <CarsView files={filteredFiles} driverNames={selectedDrivers} initialCar={viewContext} onNavigate={navigateTo} />}
            {activeView === 'benchmarks' && <RacePaceView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} onViewChange={setActiveView} />}
            {activeView === 'trackmode' && <TrackModeView files={filteredFiles} driverNames={selectedDrivers} initialTrack={viewContext} onNavigate={navigateTo} onViewChange={setActiveView} />}
            {activeView === 'races' && <RaceResultsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'profile' && <DriverProfileView files={filteredFiles} driverNames={selectedDrivers} />}
          </DataIndexProvider>
        )}
      </main>

      <Footer />
      {toasts}
    </div>
  );
}

export default App;
