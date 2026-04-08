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
4. `src/App.tsx` — Holds state: `files`, `selectedDrivers`, `selectedClasses`; applies class filter via `filterFilesByClasses()` before passing `filteredFiles` to views

### Global Filters (in Header)

- **Driver multi-select** — filters by driver name across all views
- **Car class multi-select** — filters entire dataset by class (Hyper/GT3/GTE/LMP3); applied at App level before data reaches views

### Key Files

- `src/lib/types.ts` — All TypeScript types (`RaceFile`, `SessionData`, `DriverResult`, `LapData`, `PersonalBest`, `CarClass`, etc.)
- `src/lib/parser.ts` — XML→TypeScript parser. Handles session types (Practice/Qualifying/Race/Warmup), lap data with sectors/tire wear/fuel, incidents, penalties, track limits
- `src/lib/analytics.ts` — All data computations. Functions accept `driverNames: string | string[]` to support multi-driver selection
- `src/components/SortableTable.tsx` — Reusable sortable table with fixed column widths via `<colgroup>`. All data tables use this component

### Views

Six tabs: Overview, Personal Bests, Sessions, Tracks, Cars, Race Results. Each receives `files` (already filtered by class) and `driverNames`.

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
- `data-card` CSS class for card styling with hover effects
- Car class badges are color-coded: Hyper=red, GT3=blue, GTE=orange, LMP3=green

### LMU XML Data Format

Files are named like `2026_03_14_13_23_07-86P1.xml` (timestamp + session code). Suffix indicates: P=Practice, Q=Qualifying, R=Race. The XML uses rFactor format with `<RaceResults>` root containing session elements (`<Practice1>`, `<Qualify>`, `<Race>`, etc.), each with `<Driver>` elements containing `<Lap>` elements with attributes for sector times, tire wear, fuel, speed, etc.

Sample data lives in `data/` folder (not shipped with the app).
