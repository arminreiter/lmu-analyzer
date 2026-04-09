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
- `src/lib/parser.ts` — XML→TypeScript parser. Handles session types (Practice/Qualifying/Race/Warmup), lap data with sectors/tire wear/fuel, incidents, penalties, track limits. Includes `deduplicateRaces()` to merge duplicate Race sessions (same track, within 60 min, matching driver lap times)
- `src/lib/analytics.ts` — All data computations. Functions accept `driverNames: string | string[]` to support multi-driver selection. Key functions: `getOverviewStats()`, `getPersonalBests()`, `getAllSessionBests()`, `getTheoreticalBest()`, `getTrackStats()`, `getCarStats()`, `detectPlayerDrivers()`
- `src/lib/storage.ts` — Persistence layer: IndexedDB for parsed files + FileSystemDirectoryHandle (refresh from folder), localStorage for filter preferences and profile. Graceful fallback if IndexedDB unavailable
- `src/lib/racepace.ts` — Community benchmark integration. Fetches pace tiers from ohne_speed's Google Sheet CSV. Rates laps as Alien/Competitive/Good/Midpack/Tail-ender/Offline
- `src/lib/useInstallPrompt.ts` — PWA install prompt hook

### Components

- `src/components/Header.tsx` — Sticky header: logo, driver/class filters, benchmark toggle, refresh/install/reload buttons, tab navigation
- `src/components/FolderPicker.tsx` — Initial file loading UI: folder selection (FSA), file upload fallback, resume cached data
- `src/components/SortableTable.tsx` — Reusable sortable table with fixed column widths via `<colgroup>`. All data tables use this component
- `src/components/SearchableMultiSelect.tsx` — Multi-select dropdown with search
- `src/components/SearchableSelect.tsx` — Single-select dropdown with search
- `src/components/ClassBadge.tsx` — Color-coded car class badge
- `src/components/StatCard.tsx` — Dashboard stat widget (label, value, icon, subtext)
- `src/components/ExportButton.tsx` — Export table data as CSV/XLSX
- `src/components/Footer.tsx` — Build time, links, copyright

### Views

Ten views: Overview, Personal Bests, Sessions, Session Detail, Tracks, Cars, Race Results, Race Pace, Driver Profile, About. Each receives `files` (already filtered by class) and `driverNames`.

- `OverviewView` — Dashboard with stat cards (sessions, laps, races, tracks, cars, distance, best lap) + track/car stats tables
- `PersonalBestsView` — Best laps per track/car with theoretical best (combined best sectors), filterable by track/car/mode
- `SessionsView` — All sessions with filters (setting, type, track); click row → SessionDetailView
- `SessionDetailView` — Lap-by-lap chart, tire wear analysis, fuel consumption, pitstops, incidents, penalties, track limits
- `TracksView` — Per-track performance with best laps by class, sector breakdown, car usage history
- `CarsView` — Per-car usage, best laps, track visits, sessions, distance
- `RaceResultsView` — Race outcomes with position progress chart, wins/podiums/top-5s stats, DNF tracking
- `RacePaceView` — Community benchmark comparison (ohne_speed pace tiers), rating badges, delta to next target
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

Purple is reserved — don't use it for general "best" highlighting. It only appears in the Personal Bests view for theoretical times.

### Design

- Dark theme with racing aesthetic (Orbitron for headings, Geist/Geist Mono for body)
- Tailwind CSS v4 with custom theme in `src/index.css` (`@theme` block)
- `data-card` CSS class for card styling with hover effects (angular clip-path cuts, red glow on hover)
- Car class badges are color-coded: Hyper=red, GT3=blue, GTE=orange, LMP3=green
- Visual effects: scanline animation, carbon fiber texture, checkered pattern, racing stripes
- Animations via `motion` library

### Persistence

- **IndexedDB** — Stores parsed `RaceFile[]` and `FileSystemDirectoryHandle` for folder refresh
- **localStorage** — Filter preferences (selected drivers, classes, active view), driver profile (name, avatar), benchmark toggle, data source type
- Auto-restores cached data on app load; re-reads folder if handle is still valid

### LMU XML Data Format

Files are named like `2026_03_14_13_23_07-86P1.xml` (timestamp + session code). Suffix indicates: P=Practice, Q=Qualifying, R=Race. The XML uses rFactor format with `<RaceResults>` root containing session elements (`<Practice1>`, `<Qualify>`, `<Race>`, etc.), each with `<Driver>` elements containing `<Lap>` elements with attributes for sector times, tire wear, fuel, speed, etc.

Sample data lives in `data/` folder (not shipped with the app).
