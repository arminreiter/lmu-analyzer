import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FolderPicker } from './components/FolderPicker';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OverviewView } from './views/OverviewView';
import { PersonalBestsView } from './views/PersonalBestsView';
import { SessionsView } from './views/SessionsView';
import { SessionDetailView } from './views/SessionDetailView';
import { TracksView } from './views/TracksView';
import { CarsView } from './views/CarsView';
import { RaceResultsView } from './views/RaceResultsView';
import { DriverProfileView } from './views/DriverProfileView';
import { RacePaceView } from './views/RacePaceView';
import { AboutView } from './views/AboutView';
import { loadFolder, loadFiles } from './lib/parser';
import { getAllDrivers, detectPlayerDrivers, getAllClasses, filterFilesByClasses, deduplicateRaces } from './lib/analytics';
import * as storage from './lib/storage';
import { useTheme } from './lib/useTheme';
import type { RaceFile, DriverSummary, CarClass } from './lib/types';

function App() {
  const [files, setFiles] = useState<RaceFile[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [allClasses, setAllClasses] = useState<CarClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<CarClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('overview');
  const [viewContext, setViewContext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [racePaceEnabled, setRacePaceEnabled] = useState(() => {
    try { const v = localStorage.getItem('lmu-analyzer-benchmarks'); return v === null || v === '1'; } catch { return true; }
  });
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  // Auto-restore cached data on mount
  useEffect(() => {
    (async () => {
      const cached = await storage.loadFiles();
      if (cached && cached.length > 0) {
        setHasCachedData(true);
        applyParsedData(cached, true);
        // Try to restore directory handle for refresh capability
        const handle = await storage.loadDirectoryHandle();
        if (!handle) return;
        dirHandleRef.current = handle;
        // If data came from a directory, try to re-read fresh data
        if (storage.loadDataSource() === 'directory') {
          try {
            const perm = await (handle as FileSystemDirectoryHandle & { queryPermission(desc: { mode: string }): Promise<string> }).queryPermission({ mode: 'read' });
            if (perm === 'granted') {
              const parsed = await loadFolder(handle);
              applyParsedData(parsed, true);
              await storage.saveFiles(parsed);
            }
          } catch {
            // Permission not granted or folder unavailable — cached data is still shown
          }
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist filters whenever they change (skip initial empty state)
  useEffect(() => {
    if (loaded) {
      storage.saveFilters(selectedDrivers, selectedClasses, activeView === 'session' ? 'sessions' : activeView);
    }
  }, [selectedDrivers, selectedClasses, activeView, loaded]);

  const applyParsedData = useCallback((rawParsed: RaceFile[], restoreFilters = false) => {
    if (rawParsed.length === 0) {
      setError('No valid XML race files found.');
      setLoading(false);
      return;
    }
    const parsed = deduplicateRaces(rawParsed);
    setFiles(parsed);
    const classes = getAllClasses(parsed);
    setAllClasses(classes);
    const allDriversList = getAllDrivers(parsed);
    setDrivers(allDriversList);

    const savedFilters = restoreFilters ? storage.loadFilters() : null;
    if (savedFilters) {
      // Restore saved filters, but only keep values that still exist in the data
      const validDrivers = savedFilters.selectedDrivers.filter(d => allDriversList.some(dl => dl.name === d));
      const validClasses = savedFilters.selectedClasses.filter(c => classes.includes(c));
      setSelectedDrivers(validDrivers.length > 0 ? validDrivers : detectPlayerDrivers(parsed));
      setSelectedClasses(validClasses.length > 0 ? validClasses : classes);
      setActiveView(savedFilters.activeView || 'overview');
    } else {
      setSelectedClasses(classes);
      setSelectedDrivers(detectPlayerDrivers(parsed));
    }
    setLoaded(true);
  }, []);

  const handleFolderSelected = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    dirHandleRef.current = handle;
    try {
      const parsed = await loadFolder(handle);
      applyParsedData(parsed, true);
      storage.saveFiles(parsed);
      storage.saveDataSource('directory');
      storage.saveDirectoryHandle(handle);
    } catch (e) {
      setError(`Failed to load data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData]);

  const handleFilesUploaded = useCallback(async (uploadedFiles: File[]) => {
    setLoading(true);
    setError(null);
    dirHandleRef.current = null;
    try {
      const parsed = await loadFiles(uploadedFiles);
      applyParsedData(parsed, true);
      storage.saveFiles(parsed);
      storage.saveDataSource('upload');
      storage.clearDirectoryHandle();
    } catch (e) {
      setError(`Failed to load data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData]);

  const handleRefresh = useCallback(async () => {
    const handle = dirHandleRef.current;
    if (!handle) return;
    setLoading(true);
    setError(null);
    try {
      const perm = await (handle as FileSystemDirectoryHandle & { requestPermission(desc: { mode: string }): Promise<string> }).requestPermission({ mode: 'read' });
      if (perm !== 'granted') {
        setError('Permission to read folder was denied.');
        setLoading(false);
        return;
      }
      const parsed = await loadFolder(handle);
      applyParsedData(parsed, true);
      storage.saveFiles(parsed);
    } catch (e) {
      setError(`Failed to refresh data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData]);

  const handleResumeCached = useCallback(async () => {
    const cached = await storage.loadFiles();
    if (!cached || cached.length === 0) return;
    applyParsedData(cached, true);
    const handle = await storage.loadDirectoryHandle();
    if (handle) dirHandleRef.current = handle;
  }, [applyParsedData]);

  const handleReload = useCallback(() => {
    setFiles([]);
    setDrivers([]);
    setSelectedDrivers([]);
    setAllClasses([]);
    setSelectedClasses([]);
    setLoaded(false);
    setError(null);
    storage.clearAll();
    dirHandleRef.current = null;
    setHasCachedData(false);
  }, []);

  const handleToggleRacePace = useCallback(() => {
    setRacePaceEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('lmu-analyzer-benchmarks', next ? '1' : '0'); } catch { /* ignore */ }
      if (!next && activeView === 'benchmarks') setActiveView('overview');
      return next;
    });
  }, [activeView]);

  const [prevView, setPrevView] = useState<{ view: string; context: string | null } | null>(null);
  const currentViewRef = useRef({ view: activeView, context: viewContext });
  currentViewRef.current = { view: activeView, context: viewContext };

  const navigateTo = useCallback((view: string, context?: string) => {
    if (view === 'session') {
      setPrevView(currentViewRef.current);
    }
    setActiveView(view);
    setViewContext(context ?? null);
  }, []);

  const filteredFiles = useMemo(
    () => filterFilesByClasses(files, selectedClasses),
    [files, selectedClasses]
  );

  // Resolve session detail from viewContext "fileName::sessionIndex"
  const sessionDetail = useMemo(() => {
    if (activeView !== 'session' || !viewContext) return null;
    const [fileName, idxStr] = viewContext.split('::');
    const sessionIndex = Number(idxStr);
    const file = filteredFiles.find(f => f.fileName === fileName);
    if (!file) return null;
    const session = file.sessions.find(s => s.sessionIndex === sessionIndex);
    if (!session) return null;
    const driver = session.drivers.find(d => selectedDrivers.includes(d.name));
    if (!driver) return null;
    return { file, session, driver };
  }, [activeView, viewContext, filteredFiles, selectedDrivers]);

  const handleSessionBack = useCallback(() => {
    if (prevView) {
      setActiveView(prevView.view);
      setViewContext(prevView.context);
      setPrevView(null);
    } else {
      setActiveView('sessions');
      setViewContext(null);
    }
  }, [prevView]);

  if (!loaded) {
    return (
      <FolderPicker
        onFolderSelected={handleFolderSelected}
        onFilesUploaded={handleFilesUploaded}
        onResumeCached={hasCachedData ? handleResumeCached : undefined}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-racing-black">
      <Header
        selectedDrivers={selectedDrivers}
        drivers={drivers}
        onDriverChange={setSelectedDrivers}
        allClasses={allClasses}
        selectedClasses={selectedClasses}
        onClassChange={setSelectedClasses}
        onReload={handleReload}
        onRefresh={dirHandleRef.current ? handleRefresh : undefined}
        refreshing={loading}
        activeView={activeView === 'session' ? 'sessions' : activeView}
        onViewChange={(view: string) => { setActiveView(view); setViewContext(null); setPrevView(null); }}
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
          <>
            {activeView === 'overview' && <OverviewView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'bests' && <PersonalBestsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'sessions' && <SessionsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'session' && sessionDetail && (
              <SessionDetailView file={sessionDetail.file} session={sessionDetail.session} driver={sessionDetail.driver} onBack={handleSessionBack} />
            )}
            {activeView === 'tracks' && <TracksView files={filteredFiles} driverNames={selectedDrivers} initialTrack={viewContext} onNavigate={navigateTo} />}
            {activeView === 'cars' && <CarsView files={filteredFiles} driverNames={selectedDrivers} initialCar={viewContext} onNavigate={navigateTo} />}
            {activeView === 'benchmarks' && <RacePaceView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'races' && <RaceResultsView files={filteredFiles} driverNames={selectedDrivers} onNavigate={navigateTo} />}
            {activeView === 'profile' && <DriverProfileView files={filteredFiles} driverNames={selectedDrivers} />}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
