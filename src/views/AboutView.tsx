import { Shield, Coffee, FileText, Lock, Cpu, Code2, Download, Timer } from 'lucide-react';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export function AboutView() {
  const { canInstall, install } = useInstallPrompt();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="animate-in animate-in-1">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-5 border-b border-racing-border">
            <div className="flex items-baseline justify-between">
              <h2 className="font-racing text-lg text-white tracking-wide">LMU Analyzer</h2>
              <span className="text-racing-muted/50 text-[10px] font-mono">Build {new Date(__BUILD_TIME__).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(__BUILD_TIME__).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-racing-muted text-sm mt-1">Race data analysis for Le Mans Ultimate</p>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm text-racing-text leading-relaxed">
            <p>
              LMU Analyzer parses your Le Mans Ultimate XML race data and gives you detailed statistics,
              personal bests, lap times, track and car breakdowns, and race results — all in one place.
            </p>
            <p>
              Simply point it at your LMU results folder (or upload files manually) and start exploring your racing history.
            </p>
          </div>
        </div>
      </div>

      <div className="animate-in animate-in-2">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-4 border-b border-racing-border flex items-center gap-2">
            <Lock className="w-4 h-4 text-racing-green" />
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Privacy &amp; Offline</h3>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm text-racing-text leading-relaxed">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-racing-green shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">100% client-side</p>
                <p className="text-racing-muted mt-0.5">Everything runs in your browser. No server, no database, no API calls. Your data never leaves your machine.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Cpu className="w-5 h-5 text-racing-green shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">No tracking or analytics</p>
                <p className="text-racing-muted mt-0.5">No cookies, no telemetry, no third-party scripts. Zero data is transmitted anywhere.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-racing-green shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Local storage only</p>
                <p className="text-racing-muted mt-0.5">Session data is cached in your browser's local storage so you can resume where you left off. Clear it anytime.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-in animate-in-3">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-4 border-b border-racing-border flex items-center gap-2">
            <Download className="w-4 h-4 text-racing-green" />
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Install as App</h3>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm text-racing-text leading-relaxed">
            <p>
              LMU Analyzer is a Progressive Web App (PWA). You can install it on your desktop or mobile device for quick access — it works offline and launches like a native app.
            </p>
            {canInstall ? (
              <button
                onClick={install}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all cursor-pointer
                  bg-racing-green/10 border border-racing-green/30 text-racing-green
                  hover:bg-racing-green/20 hover:border-racing-green/50"
              >
                <Download className="w-3.5 h-3.5" />
                Install LMU Analyzer
              </button>
            ) : (
              <p className="text-racing-muted text-xs">
                If the install button appears in the header (<Download className="w-3 h-3 inline" />), click it to install. On some browsers, you can also use the browser menu to add this app to your home screen.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="animate-in animate-in-4">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-4 border-b border-racing-border flex items-center gap-2">
            <Timer className="w-4 h-4 text-racing-yellow" />
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Benchmark Times</h3>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm text-racing-text leading-relaxed">
            <p>
              Benchmark lap times are provided by <span className="text-white font-medium">ohne_speed</span> — the go-to resource for LMU reference times and car setups.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://docs.google.com/spreadsheets/d/e/2PACX-1vTN03UvJDm99byA6vQPZHKOCYVvfxLu1zkJAzdaKyROykzEKY2-Xl1rl1q5znZEf36m88dxMKsY2eaO/pubhtml#gid=1766901750"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all
                  bg-racing-green/8 border border-racing-green/20 text-racing-green/80
                  hover:bg-racing-green/15 hover:text-racing-green hover:border-racing-green/35"
              >
                Benchmark Spreadsheet
              </a>
              <a
                href="https://www.youtube.com/@ohne_speed"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all
                  bg-racing-red/8 border border-racing-red/20 text-racing-red/80
                  hover:bg-racing-red/15 hover:text-racing-red hover:border-racing-red/35"
              >
                YouTube
              </a>
              <a
                href="https://discord.com/invite/dFAqhnuSXH"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all
                  bg-[#5865F2]/8 border border-[#5865F2]/20 text-[#5865F2]/80
                  hover:bg-[#5865F2]/15 hover:text-[#5865F2] hover:border-[#5865F2]/35"
              >
                Discord
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-in animate-in-5">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-4 border-b border-racing-border flex items-center gap-2">
            <Code2 className="w-4 h-4 text-racing-muted" />
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">Open Source</h3>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm text-racing-text leading-relaxed">
            <p>
              LMU Analyzer is open source. Contributions, issues, and feature requests are welcome.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/arminreiter/lmu-analyzer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all
                  bg-white/5 border border-racing-border text-racing-text
                  hover:bg-white/10 hover:text-white hover:border-racing-muted/50"
              >
                <Code2 className="w-3.5 h-3.5" />
                View on GitHub
              </a>
<a
                href="https://buymeacoffee.com/axrider"
                target="_blank"
                rel="noopener noreferrer"
                className="bmac-link inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all
                  bg-[#ffdd00]/8 border border-[#ffdd00]/20 text-[#ffdd00]/80
                  hover:bg-[#ffdd00]/15 hover:text-[#ffdd00] hover:border-[#ffdd00]/35"
              >
                <Coffee className="w-3.5 h-3.5" />
                Buy Me a Coffee
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-in animate-in-6">
        <div className="data-card carbon-fiber overflow-hidden">
          <div className="px-6 py-4 border-b border-racing-border">
            <h3 className="section-stripe text-[11px] font-semibold uppercase tracking-[0.12em] text-racing-muted">How It Works</h3>
          </div>
          <div className="px-6 py-5 text-sm text-racing-text leading-relaxed">
            <ol className="space-y-3 list-none">
              <li className="flex gap-3">
                <span className="text-racing-red font-mono font-bold shrink-0">01</span>
                <span>Select your LMU results folder using the File System Access API, or upload XML files manually (for browsers that don't support folder access).</span>
              </li>
              <li className="flex gap-3">
                <span className="text-racing-red font-mono font-bold shrink-0">02</span>
                <span>The app parses rFactor-format XML files directly in your browser — practice, qualifying, warmup, and race sessions.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-racing-red font-mono font-bold shrink-0">03</span>
                <span>Browse your stats across six views: Overview, Personal Bests, Sessions, Tracks, Cars, and Race Results.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-racing-red font-mono font-bold shrink-0">04</span>
                <span>Filter by driver and car class. Everything updates instantly — no loading, no server round-trips.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
