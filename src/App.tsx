import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FolderPicker } from './components/FolderPicker';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OverviewView } from './views/OverviewView';
import { PersonalBestsView } from './views/PersonalBestsView';
import { SessionsView } from './views/SessionsView';
import { TracksView } from './views/TracksView';
import { CarsView } from './views/CarsView';
import { RaceResultsView } from './views/RaceResultsView';
import { loadFolder, loadFiles } from './lib/parser';
import { getAllDrivers, detectPlayerDrivers, getAllClasses, filterFilesByClasses } from './lib/analytics';
import * as storage from './lib/storage';
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
  const [loaded, setLoaded] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Check for cached data on mount
  useEffect(() => {
    const cached = storage.loadFiles();
    if (cached && cached.length > 0) {
      setHasCachedData(true);
    }
  }, []);

  // Persist filters whenever they change (skip initial empty state)
  useEffect(() => {
    if (loaded) {
      storage.saveFilters(selectedDrivers, selectedClasses, activeView);
    }
  }, [selectedDrivers, selectedClasses, activeView, loaded]);

  const applyParsedData = useCallback((parsed: RaceFile[], restoreFilters = false) => {
    if (parsed.length === 0) {
      setError('No valid XML race files found.');
      setLoading(false);
      return;
    }
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
      const perm = await (handle as any).requestPermission({ mode: 'read' });
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

  const handleResumeCached = useCallback(() => {
    const cached = storage.loadFiles();
    if (!cached || cached.length === 0) return;
    applyParsedData(cached, true);
    // Try to restore directory handle from IndexedDB
    storage.loadDirectoryHandle().then(handle => {
      if (handle) dirHandleRef.current = handle;
    });
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

  const filteredFiles = useMemo(
    () => filterFilesByClasses(files, selectedClasses),
    [files, selectedClasses]
  );

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
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {selectedDrivers.length === 0 ? (
          <div className="text-center py-20 text-racing-muted">
            <p className="text-lg">No drivers selected</p>
            <p className="text-sm mt-1">Select at least one driver from the dropdown above.</p>
          </div>
        ) : (
          <>
            {activeView === 'overview' && <OverviewView files={filteredFiles} driverNames={selectedDrivers} />}
            {activeView === 'bests' && <PersonalBestsView files={filteredFiles} driverNames={selectedDrivers} />}
            {activeView === 'sessions' && <SessionsView files={filteredFiles} driverNames={selectedDrivers} />}
            {activeView === 'tracks' && <TracksView files={filteredFiles} driverNames={selectedDrivers} />}
            {activeView === 'cars' && <CarsView files={filteredFiles} driverNames={selectedDrivers} />}
            {activeView === 'races' && <RaceResultsView files={filteredFiles} driverNames={selectedDrivers} />}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
