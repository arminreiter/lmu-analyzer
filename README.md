# LMU Analyzer

A web-based race data analysis tool for [Le Mans Ultimate](https://www.lemansultimate.com/). Load your XML race result files and get detailed analytics and visualizations of your racing performance — all processed locally in your browser, no data leaves your machine.

## Features

- **Overview Dashboard** — Session count, total laps, races, tracks visited, distance driven, all-time best lap with track/car stats tables
- **Personal Bests** — Best lap times grouped by track and car, with sector splits and theoretical best (combined best sectors)
- **Session Analysis** — All sessions with drill-down: lap time progression charts, tire wear analysis (FL/FR/RL/RR), fuel consumption tracking, pitstops, incidents, penalties, track limits
- **Track Stats** — Per-track performance breakdown with best laps by class and sector analysis
- **Car Stats** — Vehicle-specific performance, usage history, and distance tracking
- **Race Results** — Race outcomes with position progress chart, wins/podiums/top-5 stats, grid vs finish positions, DNF tracking
- **Race Pace** — Compare your lap times against community benchmark tiers (Alien → Offline) powered by ohne_speed's pace data
- **Driver Profile** — Customizable profile with session stats, class breakdown, and incident summary
- **Data Export** — Export any table as CSV or XLSX
- **PWA Support** — Install as a standalone app on desktop or mobile

Supports all Le Mans Ultimate car classes: Hypercar, GT3, GTE, and LMP3.

All data stays in your browser — zero server communication. Parsed data is cached in IndexedDB for instant reload.

## Tech Stack

- React 19 + TypeScript 6
- Vite 8
- Tailwind CSS v4
- Recharts (charts)
- Motion (animations)
- xlsx (data export)
- Lucide React (icons)
- PWA with auto-updating service worker

## Getting Started

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:5173` in your browser, then select the folder containing your Le Mans Ultimate XML result files (or upload them manually in Brave/Firefox).

## Building for Production

```bash
pnpm run build
pnpm run preview
```

## How It Works

Le Mans Ultimate exports XML files containing detailed session data — lap times, sector splits, tire wear, fuel levels, incidents, penalties, and more. LMU Analyzer parses these files entirely in your browser and presents the data through an interactive dashboard with charts and sortable tables, letting you track your progress and identify areas for improvement.

The app uses the File System Access API to read your race data folder directly (with a file upload fallback for browsers that don't support it). Parsed data is cached locally so you can pick up where you left off.

## Support

If you find this tool useful, consider supporting development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/axrider)
