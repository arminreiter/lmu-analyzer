import { useState, useCallback, useMemo } from 'react';
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

  const applyParsedData = useCallback((parsed: RaceFile[]) => {
    if (parsed.length === 0) {
      setError('No valid XML race files found.');
      setLoading(false);
      return;
    }
    setFiles(parsed);
    const classes = getAllClasses(parsed);
    setAllClasses(classes);
    setSelectedClasses(classes);
    const allDrivers = getAllDrivers(parsed);
    setDrivers(allDrivers);
    const players = detectPlayerDrivers(parsed);
    setSelectedDrivers(players);
    setLoaded(true);
  }, []);

  const handleFolderSelected = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError(null);
    try {
      applyParsedData(await loadFolder(handle));
    } catch (e) {
      setError(`Failed to load data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData]);

  const handleFilesUploaded = useCallback(async (uploadedFiles: File[]) => {
    setLoading(true);
    setError(null);
    try {
      applyParsedData(await loadFiles(uploadedFiles));
    } catch (e) {
      setError(`Failed to load data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applyParsedData]);

  const handleReload = useCallback(() => {
    setFiles([]);
    setDrivers([]);
    setSelectedDrivers([]);
    setAllClasses([]);
    setSelectedClasses([]);
    setLoaded(false);
    setError(null);
  }, []);

  const filteredFiles = useMemo(
    () => filterFilesByClasses(files, selectedClasses),
    [files, selectedClasses]
  );

  if (!loaded) {
    return <FolderPicker onFolderSelected={handleFolderSelected} onFilesUploaded={handleFilesUploaded} loading={loading} error={error} />;
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
