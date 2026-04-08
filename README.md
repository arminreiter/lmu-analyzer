# LMU Analyzer

A web-based race data analysis tool for [Le Mans Ultimate](https://www.lemansultimate.com/). Load your XML race result files and get detailed analytics and visualizations of your racing performance.

## Features

- **Overview Dashboard** — Session count, total laps, races, tracks visited, distance driven, all-time best lap
- **Personal Bests** — Best lap times grouped by track and car class, with sector splits
- **Session Analysis** — Lap time progression charts, tire wear analysis (FL/FR/RL/RR), fuel consumption tracking, finish positions and pitstops
- **Track Stats** — Per-track performance breakdown
- **Car Stats** — Vehicle-specific performance data
- **Race Results** — Race outcomes, grid/class positions, lap counts

Supports all Le Mans Ultimate car classes: Hypercar, GT3, GTE, and LMP3.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Recharts

## Getting Started

```bash
cd lmu-app
npm install
npm run dev
```

Open `http://localhost:5173` in your browser, then select the folder containing your Le Mans Ultimate XML result files (or upload them manually).

## Building for Production

```bash
npm run build
npm run preview
```

## How It Works

Le Mans Ultimate exports XML files containing detailed session data — lap times, sector splits, tire wear, fuel levels, incidents, and more. LMU Analyzer parses these files and presents the data through an interactive dashboard with charts and tables, letting you track your progress and identify areas for improvement.

## Support

If you find this tool useful, consider supporting development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/axrider)
