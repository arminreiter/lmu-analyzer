import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { Trophy, Flag, Route, Gauge, MapPin, Car, Medal, CircleOff, Pencil, Camera, X, Globe, Shield, Zap, Target, Settings } from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { SortableTable, type Column } from '../components/SortableTable';
import { formatLapTime, formatSector, getDriverProfileStats, type TrackBest } from '../lib/analytics';
import { saveProfileName, loadProfileName, saveProfileAvatar, loadProfileAvatar, clearProfileAvatar } from '../lib/storage';
import type { RaceFile } from '../lib/types';

const PROFILE_SETTINGS_KEY = 'lmu-analyzer-profile-settings';

interface ProfileSettings {
  showTotalRaces: boolean;
  showOnlineRaces: boolean;
  showRatedRaces: boolean;
  showTheoreticalBest: boolean;
  showLapCount: boolean;
  hiddenCircuits: string[];
}

const defaultSettings: ProfileSettings = {
  showTotalRaces: true,
  showOnlineRaces: false,
  showRatedRaces: true,
  showTheoreticalBest: false,
  showLapCount: true,
  hiddenCircuits: [],
};

function loadSettings(): ProfileSettings {
  try {
    const raw = localStorage.getItem(PROFILE_SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings;
}

function saveSettings(s: ProfileSettings) {
  try { localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

interface DriverProfileViewProps {
  files: RaceFile[];
  driverNames: string[];
}


const circuitColumn: Column<TrackBest> = {
  key: 'track', label: 'Circuit',
  sortValue: t => t.trackVenue,
  render: t => (
    <div>
      <span className="text-white font-medium">{t.trackVenue}</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-racing-muted text-[10px]">{t.bestCar}</span>
        <ClassBadge carClass={t.bestCarClass} />
      </div>
    </div>
  ),
};

const lapsColumn: Column<TrackBest> = {
  key: 'laps', label: 'Laps', align: 'right', mono: true, width: '4.5rem',
  sortValue: t => t.totalLaps,
  render: t => <span className="text-racing-muted">{t.totalLaps}</span>,
};

const bestLapColumns: Column<TrackBest>[] = [
  {
    key: 'best', label: 'Best Lap', align: 'right', mono: true, width: '7rem',
    sortValue: t => t.bestLapTime,
    render: t => <span className="text-racing-green font-bold whitespace-nowrap">{formatLapTime(t.bestLapTime)}</span>,
  },
  {
    key: 's1', label: 'S1', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS1,
    render: t => {
      const isTheoMatch = t.theoS1 !== null && t.bestS1 !== null && Math.abs(t.bestS1 - t.theoS1) < 0.0005;
      return <span className={`whitespace-nowrap ${isTheoMatch ? 'text-racing-purple' : 'text-racing-muted'}`}>{formatSector(t.bestS1)}</span>;
    },
  },
  {
    key: 's2', label: 'S2', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS2,
    render: t => {
      const isTheoMatch = t.theoS2 !== null && t.bestS2 !== null && Math.abs(t.bestS2 - t.theoS2) < 0.0005;
      return <span className={`whitespace-nowrap ${isTheoMatch ? 'text-racing-purple' : 'text-racing-muted'}`}>{formatSector(t.bestS2)}</span>;
    },
  },
  {
    key: 's3', label: 'S3', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.bestS3,
    render: t => {
      const isTheoMatch = t.theoS3 !== null && t.bestS3 !== null && Math.abs(t.bestS3 - t.theoS3) < 0.0005;
      return <span className={`whitespace-nowrap ${isTheoMatch ? 'text-racing-purple' : 'text-racing-muted'}`}>{formatSector(t.bestS3)}</span>;
    },
  },
];

const theoTrackColumns: Column<TrackBest>[] = [
  {
    key: 'theoretical', label: 'Theoretical', align: 'right', mono: true, width: '7rem',
    sortValue: t => t.theoreticalBest ?? Infinity,
    render: t => t.theoreticalBest
      ? <span className="text-racing-purple font-bold whitespace-nowrap">{formatLapTime(t.theoreticalBest)}</span>
      : <span className="text-racing-muted/30 whitespace-nowrap">--:--.---</span>,
  },
  {
    key: 'theoS1', label: 'S1', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.theoS1,
    headerClass: 'text-racing-purple/60',
    render: t => <span className="text-racing-purple/60 whitespace-nowrap">{formatSector(t.theoS1)}</span>,
  },
  {
    key: 'theoS2', label: 'S2', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.theoS2,
    headerClass: 'text-racing-purple/60',
    render: t => <span className="text-racing-purple/60 whitespace-nowrap">{formatSector(t.theoS2)}</span>,
  },
  {
    key: 'theoS3', label: 'S3', align: 'right', mono: true, width: '5.5rem',
    sortValue: t => t.theoS3,
    headerClass: 'text-racing-purple/60',
    render: t => <span className="text-racing-purple/60 whitespace-nowrap">{formatSector(t.theoS3)}</span>,
  },
];

export const DriverProfileView = memo(function DriverProfileView({ files, driverNames }: DriverProfileViewProps) {
  const profile = useMemo(() => getDriverProfileStats(files, driverNames), [files, driverNames]);

  // Editable name
  const [displayName, setDisplayName] = useState(() => loadProfileName() ?? profile.driverName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const nameRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatar, setAvatar] = useState<string | null>(() => loadProfileAvatar());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [settings, setSettings] = useState<ProfileSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  function updateSetting(key: 'showTotalRaces' | 'showOnlineRaces' | 'showRatedRaces' | 'showTheoreticalBest' | 'showLapCount') {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettings(next);
      return next;
    });
  }

  function toggleCircuit(trackVenue: string) {
    setSettings(prev => {
      const hidden = prev.hiddenCircuits.includes(trackVenue)
        ? prev.hiddenCircuits.filter(c => c !== trackVenue)
        : [...prev.hiddenCircuits, trackVenue];
      const next = { ...prev, hiddenCircuits: hidden };
      saveSettings(next);
      return next;
    });
  }

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const trackColumns = useMemo(() => {
    const cols: Column<TrackBest>[] = [circuitColumn];
    if (settings.showLapCount) cols.push(lapsColumn);
    cols.push(...bestLapColumns);
    if (settings.showTheoreticalBest) cols.push(...theoTrackColumns);
    return cols;
  }, [settings.showTheoreticalBest, settings.showLapCount]);

  const visibleTrackBests = useMemo(() =>
    profile.trackBests.filter(t => !settings.hiddenCircuits.includes(t.trackVenue)),
    [profile.trackBests, settings.hiddenCircuits]
  );

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setDisplayName(trimmed);
      saveProfileName(trimmed);
    } else {
      setNameInput(displayName);
    }
    setEditingName(false);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setAvatar(dataUrl);
        saveProfileAvatar(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removeAvatar() {
    setAvatar(null);
    clearProfileAvatar();
  }

  const hasOnline = profile.online.races > 0;
  const hasRated = profile.rated.races > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5 relative">
      {/* Settings — positioned above the card so overflow-hidden doesn't clip it */}
      <div ref={settingsRef} className="absolute right-0 top-1 z-30">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${settingsOpen ? 'bg-racing-highlight/20 text-white' : 'text-racing-muted/30 hover:text-racing-muted'}`}
        >
          <Settings className="w-4 h-4" />
        </button>
        {settingsOpen && (
          <div className="absolute right-0 top-10 w-72 bg-racing-card border border-racing-border rounded-lg shadow-xl py-2 max-h-80 overflow-y-auto">
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-racing-muted/50 font-medium">Sections</div>
            <SettingsToggle label="Total Races" checked={settings.showTotalRaces} onChange={() => updateSetting('showTotalRaces')} />
            <SettingsToggle label="Online Races" checked={settings.showOnlineRaces} onChange={() => updateSetting('showOnlineRaces')} />
            <SettingsToggle label="Rated Races" checked={settings.showRatedRaces} onChange={() => updateSetting('showRatedRaces')} />
            <SettingsToggle label="Theoretical Best" checked={settings.showTheoreticalBest} onChange={() => updateSetting('showTheoreticalBest')} />
            <SettingsToggle label="Lap Count" checked={settings.showLapCount} onChange={() => updateSetting('showLapCount')} />
            {profile.trackBests.length > 0 && (
              <>
                <div className="border-t border-racing-border/30 my-1.5" />
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-racing-muted/50 font-medium">Circuits</div>
                {profile.trackBests.map(t => (
                  <SettingsToggle
                    key={t.trackVenue}
                    label={t.trackVenue}
                    checked={!settings.hiddenCircuits.includes(t.trackVenue)}
                    onChange={() => toggleCircuit(t.trackVenue)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Profile Header */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-1">
        <div className="px-6 py-6 flex items-center gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            {avatar ? (
              <div className="w-16 h-16 rounded-full border-2 border-racing-red/40 overflow-hidden">
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-racing-red/20 border-2 border-racing-red/40 flex items-center justify-center">
                <span className="font-racing text-xl text-racing-red">
                  {displayName.split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            {avatar && (
              <button
                onClick={removeAvatar}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-racing-dark border border-racing-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3 h-3 text-racing-muted" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Name */}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameInput(displayName); setEditingName(false); } }}
                className="font-racing text-2xl text-white tracking-wide bg-transparent border-b-2 border-racing-red/50 outline-none w-full"
              />
            ) : (
              <button
                onClick={() => { setNameInput(displayName); setEditingName(true); }}
                className="flex items-center gap-2 group/name cursor-pointer"
              >
                <h2 className="font-racing text-2xl text-white tracking-wide truncate">{displayName}</h2>
                <Pencil className="w-3.5 h-3.5 text-racing-muted opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
            <p className="text-racing-muted text-xs mt-1 font-mono">
              {profile.tracksVisited} tracks &middot; {profile.carsUsed} cars &middot; {profile.totalSessions} sessions
            </p>
          </div>
        </div>
      </div>

      {/* All Race Stats */}
      {settings.showTotalRaces && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 animate-in animate-in-2">
          <StatTile label="Races" value={profile.total.races} icon={<Flag className="w-4 h-4" />} />
          <StatTile label="Wins" value={profile.total.wins} icon={<Trophy className="w-4 h-4" />}
            accent="text-racing-gold"
            sub={profile.total.classWins !== profile.total.wins ? `${profile.total.classWins} class` : undefined} />
          <StatTile label="Podiums" value={profile.total.podiums} icon={<Medal className="w-4 h-4" />}
            accent="text-racing-green"
            sub={profile.total.classPodiums !== profile.total.podiums ? `${profile.total.classPodiums} class` : undefined} />
          <StatTile label="Poles" value={profile.total.poles} icon={<Target className="w-4 h-4" />} />
          <StatTile label="Fastest Laps" value={profile.total.fastestLaps} icon={<Zap className="w-4 h-4" />}
            accent={profile.total.fastestLaps > 0 ? 'text-racing-purple' : undefined} />
          <StatTile label="DNFs" value={profile.total.dnfs} icon={<CircleOff className="w-4 h-4" />}
            accent={profile.total.dnfs > 0 ? 'text-racing-red' : 'text-racing-green'} />
        </div>
      )}

      {/* Online Race Stats */}
      {settings.showOnlineRaces && hasOnline && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 animate-in animate-in-2">
          <StatTile label="Online Races" value={profile.online.races} icon={<Globe className="w-4 h-4" />} />
          <StatTile label="Online Wins" value={profile.online.wins} icon={<Trophy className="w-4 h-4" />}
            accent="text-racing-gold"
            sub={profile.online.classWins !== profile.online.wins ? `${profile.online.classWins} class` : undefined} />
          <StatTile label="Online Podiums" value={profile.online.podiums} icon={<Medal className="w-4 h-4" />}
            accent="text-racing-green"
            sub={profile.online.classPodiums !== profile.online.podiums ? `${profile.online.classPodiums} class` : undefined} />
          <StatTile label="Online Poles" value={profile.online.poles} icon={<Target className="w-4 h-4" />} />
          <StatTile label="Online FL" value={profile.online.fastestLaps} icon={<Zap className="w-4 h-4" />}
            accent={profile.online.fastestLaps > 0 ? 'text-racing-purple' : undefined} />
          <StatTile label="Online DNFs" value={profile.online.dnfs} icon={<CircleOff className="w-4 h-4" />}
            accent={profile.online.dnfs > 0 ? 'text-racing-red' : 'text-racing-green'} />
        </div>
      )}

      {/* Rated Race Stats */}
      {settings.showRatedRaces && hasRated && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 animate-in animate-in-2">
          <StatTile label="Rated Races" value={profile.rated.races} icon={<Shield className="w-4 h-4" />} />
          <StatTile label="Rated Wins" value={profile.rated.wins} icon={<Trophy className="w-4 h-4" />}
            accent="text-racing-gold"
            sub={profile.rated.classWins !== profile.rated.wins ? `${profile.rated.classWins} class` : undefined} />
          <StatTile label="Rated Podiums" value={profile.rated.podiums} icon={<Medal className="w-4 h-4" />}
            accent="text-racing-green"
            sub={profile.rated.classPodiums !== profile.rated.podiums ? `${profile.rated.classPodiums} class` : undefined} />
          <StatTile label="Rated Poles" value={profile.rated.poles} icon={<Target className="w-4 h-4" />} />
          <StatTile label="Rated FL" value={profile.rated.fastestLaps} icon={<Zap className="w-4 h-4" />}
            accent={profile.rated.fastestLaps > 0 ? 'text-racing-purple' : undefined} />
          <StatTile label="Rated DNFs" value={profile.rated.dnfs} icon={<CircleOff className="w-4 h-4" />}
            accent={profile.rated.dnfs > 0 ? 'text-racing-red' : 'text-racing-green'} />
        </div>
      )}

      {/* Volume Stats */}
      <div className="grid grid-cols-3 gap-3 animate-in animate-in-3">
        <StatTile label="Total Laps" value={profile.totalLaps.toLocaleString()} icon={<Route className="w-4 h-4" />} />
        <StatTile label="Distance" value={`${Math.round(profile.totalDistanceKm).toLocaleString()} km`} icon={<Gauge className="w-4 h-4" />} />
        <StatTile label="Tracks" value={profile.tracksVisited} icon={<MapPin className="w-4 h-4" />} />
      </div>

      {/* Best Laps per Track */}
      <div className="data-card carbon-fiber overflow-hidden animate-in animate-in-4">
        <div className="px-5 py-3 border-b border-racing-border flex items-center gap-2 checkered">
          <Car className="w-3.5 h-3.5 text-racing-muted/50" />
          <h3 className="section-stripe font-racing text-xs font-bold text-white tracking-[0.1em]">BEST LAP PER CIRCUIT</h3>
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{visibleTrackBests.length} tracks</span>
        </div>
        <SortableTable<TrackBest>
          columns={trackColumns}
          data={visibleTrackBests}
          rowKey={t => t.trackVenue}
        />
      </div>

      {/* Shareable footer badge */}
      <div className="text-center py-3 animate-in animate-in-5">
        <p className="text-racing-muted/30 text-[10px] tracking-widest uppercase font-mono">LMU Analyzer &middot; lmu-analyzer.pages.dev</p>
      </div>
    </div>
  );
});

function StatTile({ label, value, icon, accent, sub }: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="data-card carbon-fiber p-4 group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-racing-muted">{label}</span>
        {icon && <span className="text-racing-muted/40 group-hover:text-racing-red/60 transition-colors">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${accent ?? 'text-white'}`}>
        {value}
      </div>
      {sub && <p className="text-racing-muted text-[10px] mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-racing-highlight/10 transition-colors cursor-pointer"
    >
      <span className="text-racing-text text-left truncate mr-3">{label}</span>
      <div className={`w-8 shrink-0 h-4.5 rounded-full relative transition-colors ${checked ? 'bg-racing-red' : 'bg-racing-muted/20'}`}>
        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
