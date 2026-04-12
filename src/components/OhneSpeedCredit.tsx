import { ExternalLink } from 'lucide-react';

export function OhneSpeedCredit() {
  return (
    <div className="data-card carbon-fiber px-5 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-racing-muted text-xs">
            Pace benchmarks by{' '}
            <span className="text-white font-medium">ohne_speed</span>
          </p>
          <p className="text-racing-muted/60 text-[10px] mt-0.5">
            Community-sourced race pace reference data for Le Mans Ultimate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://www.youtube.com/@ohne_speed"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              bg-white/5 border border-racing-border text-racing-text
              hover:bg-white/10 hover:text-white hover:border-racing-muted/50"
          >
            <ExternalLink className="w-3 h-3" />
            YouTube
          </a>
          <a
            href="https://discord.com/invite/dFAqhnuSXH"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              bg-white/5 border border-racing-border text-racing-text
              hover:bg-white/10 hover:text-white hover:border-racing-muted/50"
          >
            <ExternalLink className="w-3 h-3" />
            Discord
          </a>
        </div>
      </div>
    </div>
  );
}
