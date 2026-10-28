# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LMU Analyzer — a client-side web app for analyzing Le Mans Ultimate (sim racing) XML race data. Users select a local folder or upload XML files; all parsing and visualization happens in the browser with zero server communication.

Built by Armin Reiter (axrider) at a31 Labs. Deployed to Cloudflare Pages.

## Commands

```bash
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run build        # TypeScript check + Vite production build
pnpm run lint         # ESLint
pnpm run preview      # Preview production build locally
```

Build outputs to `dist/`. Deployed via Cloudflare Pages (`wrangler.jsonc`).

## Architecture

**Pure client-side app** — no backend, no database, no API calls. Data stays in the browser.

### Data Flow

1. User selects folder (File System Access API) or uploads files (fallback for Brave/Firefox)
2. `src/lib/parser.ts` — Parses rFactor XML format into typed `RaceFile[]` structures
3. `src/lib/analytics.ts` — Computes stats, personal bests, race results from parsed data
4. `src/lib/storage.ts` — Persists parsed data to IndexedDB, filters/preferences to localStorage
5. `src/App.tsx` — Holds state: `files`, `selectedDrivers`, `selectedClasses`; applies class filter via `filterFilesByClasses()` before passing `filteredFiles` to views

### Global Filters (in Header)

- **Driver multi-select** — filters by driver name across all views (shows session/lap count badges per driver)
- **Car class multi-select** — filters entire dataset by class (Hyper/GT3/GTE/LMP3); applied at App level before data reaches views
- **Benchmark toggle** — enables/disables community pace comparison (Race Pace view)

### Key Files

- `src/lib/types.ts` — All TypeScript types (`RaceFile`, `SessionData`, `DriverResult`, `LapData`, `PersonalBest`, `CarClass`, etc.)
- `src/lib/parser.ts` — XML→TypeScript parser (`loadFolder()`, `parseUploadedFiles()`, both return `{ files, failedFiles }`). Handles session types (Practice/Qualifying/Race/Warmup), lap data with sectors/tire wear/fuel, incidents, penalties, track limits
- `src/lib/analytics.ts` — All data computations. Functions accept `driverNames: string | string[]` to support multi-driver selection. Key functions: `getOverviewStats()`, `getPersonalBests()`, `getAllSessionBests()`, `getTheoreticalBest()`, `getTrackStats()`, `getCarStats()`, `detectPlayerDrivers()`, plus shared predicates `isDnf()`, `isValidLap()`, `isOnline()`, `isRatedRace()`. Includes `deduplicateSessions()` to merge duplicate Race sessions (matching timestamp, track, and source tag)
- `src/lib/storage.ts` — Persistence layer: IndexedDB for parsed files (versioned cache) + FileSystemDirectoryHandle (refresh from folder), localStorage for filter preferences and profile via exported `KEYS` registry (all localStorage keys must be registered there so `clearAll()` sees them). Graceful fallback if IndexedDB unavailable
- `src/lib/racepace.ts` — Community benchmark integration. Fetches pace tiers from ohne_speed's Google Sheet CSV. Rates laps as Alien/Competitive/Good/Midpack/Tail-ender/Offline. Single source of truth for tier order (`RATING_ORDER`), tier colors, and benchmark lookup (`buildBenchmarkMap()`)
- `src/lib/DataIndexContext.tsx` + `dataIndexStore.ts` + `useDataIndex.ts` — Context providing precomputed indices over the loaded files (per-driver sessions, all laps, sector minimums for theoretical bests)
- `src/lib/live.ts` — Desktop live telemetry: `useLiveTelemetry()` (polls `lmu_live`, tracks session laps/sectors), `useLiveReferences()` (my PBs, theoretical best, benchmark tiers for the live track+class), `timingClass()` (purple/green/yellow sector colors), `displayedLap()`/`refSectors()`/`sectorDeltas()`, `useLiveTargets()`/`useHiddenTargets()` (id sets synced between main and overlay window via the `storage` event), `activeTargets()`, `toggleOverlay()`
- `src/lib/stints.ts` — `getStints()` (split at pit laps — the pit flag is on the in-lap; per-stint pace/trend/fuel/VE/wear/pit loss), `usageLaps()`/`usagePerLap()`/`usageMedians()` (skip lap 1, in- and out-laps: LMU books the refuel into the out-lap's fuelUsed/veUsed — run `usageLaps` on a driver's whole lap list, never a stint slice), `cleanLapTimes()`, `planFuel()`/`lapsForMinutes()` for the Fuel Calculator, `truePace()` (median of the 5 fastest laps), `getClassGaps()` (gap to class leader / car ahead per lap, from lap completion times)
- `src/lib/sessionMenu.tsx` — `SessionActionsContext` (navigate + excluded sessions, provided by App) and `useSessionMenu()`: right-click items (open session, copy lap time, exclude/include) for any table row that points at a session
- `src/lib/shareCard.ts` — Share images drawn on a canvas (1200×630, always dark): `sessionCard()`, `lapCard()`, `downloadShareCard()`, `copyShareCard()`
- `src/lib/shareLink.ts` — `buildShareLink()`/`parseShareLink()`: one session deflated into `#shared/<base64url>` (the shared driver's full laps, class rivals as lap tuples, no chat); the desktop app links to lmu.a31.at. Rendered by `SharedSessionView` without any loaded data, inside an error boundary
- `src/lib/backup.ts` — `exportBackup()`/`importBackup()`: cached files + every `KEYS` value (except files/dataSource) as gzipped JSON; restore validates the file shapes, writes storage, detaches the results folder (a re-read would replace the restored results), then the page reloads
- `src/lib/download.ts` — `downloadBlob()`, `compress()`/`decompress()` (native CompressionStream)
- `src/lib/sessionNotes.ts` — `useSessionNotes()`: free-text note + tags per session (sessionKey ids) in localStorage; kept on data reload (`KEEP_ON_CLEAR`)
- `src/lib/useBenchmarks.ts` — Hook wrapping the benchmark fetch (returns `benchmarks`, `benchmarkMap`, `loading`, `error`)
- `src/lib/sessionContext.ts` — `buildSessionContext()`/`parseSessionContext()` for the session-navigation string
- `src/lib/formatting.ts` — Time/number formatters, `errorMessage()`, chart theme constants (`CHART_AXIS_TICK`, `CHART_GRID_STROKE`)
- `src/lib/sessionNotifications.ts` — Desktop only: diffs datasets before/after a folder-watch refresh and sends Windows notifications for new PBs/sessions
- `src-tauri/src/lib.rs` — Desktop commands: `read_results` (read XMLs), `find_results_dir` (auto-detect LMU folder across Steam libraries), `watch_results` (emits `results-changed` on new XMLs), `lmu_live` (proxies LMU's REST API at `localhost:6397/rest/watch/{standings,sessionInfo}` — the game sends no CORS headers)
- `src/lib/useInstallPrompt.ts` — PWA install prompt hook; `useTheme.ts` — light/dark theme; `useClickOutside.ts` — shared outside-click hook (use this, don't hand-roll listeners)

### Components

- `src/components/Header.tsx` — Sticky header: logo, driver/class filters, benchmark toggle, refresh/install/reload buttons, tab navigation
- `src/components/FolderPicker.tsx` — Initial file loading UI: folder selection (FSA), file upload fallback, resume cached data
- `src/components/SortableTable.tsx` — Reusable sortable table with fixed column widths via `<colgroup>`. All data tables use this component. `rowMenu` adds a right-click menu (`ContextMenu.tsx`, portalled to body)
- `src/components/SearchableMultiSelect.tsx` — Multi-select dropdown with search
- `src/components/SearchableSelect.tsx` — Single-select dropdown with search
- `src/components/ClassBadge.tsx` — Color-coded car class badge
- `src/components/StatCard.tsx` — Stat widget (label, value, icon, subtext) with variants `default`/`tile`/`center`; use these instead of hand-built stat divs
- `src/components/ExportButton.tsx` — Export table data as CSV/XLSX (slugifies the `filename` prop itself — pass raw names)
- `src/components/Footer.tsx` — Build time, links, copyright
- `src/components/DataCardHeader.tsx` — Standard card header (title, actions slot) used by all data cards
- `src/components/RatingBadge.tsx` — Pace-tier badge (sizes `sm`/`md`)
- `src/components/PaceSubNav.tsx` — Overview/Per-Track tab bar shared by Race Pace and Track Mode
- `src/components/PillSelector.tsx`, `FilterButtonGroup.tsx` — Shared filter controls
- `src/components/SessionLink.tsx` — Link into Session Detail (uses `sessionContext.ts`)
- `src/components/ErrorBoundary.tsx` — Generic boundary (`fallback` prop); wraps the whole app in `main.tsx` with `AppCrashed` (offers clearing cached results) and the shared view
- `src/components/EntityLinks.tsx` — `TrackLink`/`CarLink`: a track or car name that opens the Tracks/Cars view (via `SessionActionsContext`); use these wherever a track or car name is shown
- `src/components/SessionNotesCard.tsx` — Notes/tags editor in Session Detail; `TagChip`
- `src/components/OhneSpeedCredit.tsx` — Benchmark data attribution
- `src/components/LapClock.tsx` — Running lap time, interpolated per frame between telemetry polls (writes the DOM directly, no re-render)
- `src/components/lapColumns.tsx` — Shared lap-table column definitions for Tracks/Cars views

### Views

Thirteen views: Live (desktop only), Overview, Personal Bests, Sessions, Session Detail, Tracks, Cars, Race Results, Fuel Calculator, Race Pace, Track Mode, Driver Profile, About. Each receives `files` (already filtered by class) and `driverNames`.

- `LiveView` — Desktop only. Polls `lmu_live` every 100ms; current/last lap sector strip, gap table (SortableTable) to my PB, theoretical best, benchmark tiers and optionally my individual laps (Targets / Top 10 / All) for the current track+class; row click toggles targets (multi-select) shared with the overlay; invalidated laps shown in orange
- `OverlayView` — Not a tab: the always-on-top, transparent overlay window (`index.html?overlay`, routed in `main.tsx`), styled after LMU's timing widget (Lap/Last/Best/Current, sector bar with sector times, one delta row per selected target); gear menu toggles each section (`PARTS`, persisted via `useOverlayHiddenParts()`), sets the purple rule (`usePurpleMode()`: beat all selected targets / my best sector with any car of the class / with this car) and picks targets. Loads cached files itself; resizes its window to the card. Game must run borderless/windowed to see it
- `OverviewView` — Dashboard with stat cards (sessions, laps, races, tracks, cars, distance, best lap) + track/car stats tables
- `PersonalBestsView` — Best laps per track/car with true pace and theoretical best (combined best sectors), filterable by track/car/mode (and fixed/open setups when the data has both)
- `SessionsView` — All sessions with filters (setting, type, track, tag, setups) and a search over notes/tags/track/car; click row → SessionDetailView
- `SessionDetailView` — Share menu (image / link), lap-by-lap chart, class gap chart (races), stints (incl. driver changes), tire wear analysis, fuel consumption, pitstops, incidents, penalties, track limits, session-best sector timeline, chat
- `FuelCalculatorView` — Fuel/VE race plan for a track+car, prefilled with your median use per lap (1x fuel-rate sessions only); stops, per-stint fill
- `TracksView` — Per-track performance with best laps by class, sector breakdown, car usage history, PB progression per car
- `CarsView` — Per-car usage, best laps, track visits, sessions, distance
- `RaceResultsView` — Race outcomes with position progress chart, wins/podiums/top-5s stats, DNF tracking
- `RacePaceView` — Community benchmark comparison (ohne_speed pace tiers), rating badges, delta to next target
- `TrackModeView` — Per-track deep dive: your times vs benchmark tiers and theoretical best for a selected track
- `DriverProfileView` — Name/avatar editor, session stats, class breakdown, track frequency, incident summary
- `AboutView` — App info, links, build time

### Racing Color Convention

Follow F1/WEC timing screen semantics:
- **Purple** (`--color-racing-purple`) — Theoretical best only (best possible lap from combining best individual sectors)
- **Gold** (`--color-racing-gold`) — Fastest actual lap at a track
- **Green** (`--color-racing-green`) — Session best lap/sector, positive status (finished normally, position gained)
- **Yellow** (`--color-racing-yellow`) — Fuel data, caution
- **Red** (`--color-racing-red`) — Brand accent, penalties, DNFs, danger
- **Orange** (`--color-racing-orange`) — Incidents, warnings
- **White** — Normal data values in tables

Purple is reserved — don't use it for general "best" highlighting. It only appears for theoretical times (Personal Bests view) and, live, for a sector that beats my all-time best sector (i.e. improves the theoretical best) — what it must beat is a user setting (`PurpleMode` in `live.ts`: all selected targets, my PB all cars of the class, or my PB this car).

### Design

- Dark theme with racing aesthetic (Orbitron for headings, Geist/Geist Mono for body)
- Tailwind CSS v4 with custom theme in `src/index.css` (`@theme` block)
- `data-card` CSS class for card styling with hover effects (angular clip-path cuts, red glow on hover)
- Car class badges are color-coded: Hyper=red, GT3=blue, GTE=orange, LMP3=green
- Visual effects: scanline animation, carbon fiber texture, checkered pattern, racing stripes
- Animations are pure CSS (scanline, hover effects) — no animation library

### Persistence

- **IndexedDB** — Stores parsed `RaceFile[]` and `FileSystemDirectoryHandle` for folder refresh
- **Backup** — Driver Profile settings (export/restore) and the folder picker (restore) move all of the above between browsers/machines
- **localStorage** — Filter preferences (selected drivers, classes, active view), driver profile (name, avatar), benchmark toggle, data source type
- Auto-restores cached data on app load; re-reads folder if handle is still valid

### LMU XML Data Format

Besides incidents/penalties/track limits, the `<Stream>` holds `<DriverChange>` (often incomplete — compare with the driver's `<NumDriverChanges>`), `<ChatMessage>` and `<Sector>` (new class-best sector; et can run ~2s off the lap clock after a rejoin, and records get re-logged out of order). Repeats are dropped with `dropRepeats()` (analytics.ts) both when parsing and when merging rejoin fragments. A swap is logged during the stop, after the out-lap's `et` (lap start). Prefer each car's own `<Swap startLap endLap>` list (authoritative). A range ends on the in-lap or the out-lap after it depending on where the stop falls, so stints are attributed by their in-lap; a leading `1–1` swap on an untimed lap 1 is the livery's placeholder driver and is folded away when parsing; stints also split at swaps away from a stop (garage swaps). The stream log is matched by livery name, which several cars can share — `carDriverChanges()` filters by the entry `Slot=` (or, for older caches, the swap chain linked to the entry's driver). Sector-record repeats use a 45 s window per file but 5 s when merging rejoin fragments (their clocks can restart). A missing `<NumDriverChanges>` means unknown, not 0. These are optional on `SessionData` because older caches lack them; `loadCachedFiles()` flags such caches as `legacy` so the re-import notice shows. `FixedSetups`/`FixedUpgrades`/`TireWarmers` are undefined when missing.

Files are named like `2026_03_14_13_23_07-86P1.xml` (timestamp + session code). Suffix indicates: P=Practice, Q=Qualifying, R=Race. The XML uses rFactor format with `<RaceResults>` root containing session elements (`<Practice1>`, `<Qualify>`, `<Race>`, etc.), each with `<Driver>` elements containing `<Lap>` elements with attributes for sector times, tire wear, fuel, speed, etc.

Sample data lives in `data/` folder (not shipped with the app).
