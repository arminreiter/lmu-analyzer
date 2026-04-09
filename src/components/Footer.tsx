import { Coffee, Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-racing-border/50">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-racing-red flex items-center justify-center"
              style={{ clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}>
              <span className="font-racing text-[6px] font-black text-white">LMU</span>
            </div>
            <span className="text-racing-muted/60 text-xs">
              Built by{' '}
              <a href="https://a31.at" target="_blank" rel="noopener noreferrer"
                className="text-racing-muted hover:text-racing-red transition-colors">
                axrider
              </a>
            </span>
          </div>

          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-racing-muted/30 text-[10px] tracking-wider">
              <Shield className="w-3 h-3" />
              100% CLIENT-SIDE
            </span>
            <a
              href="https://buymeacoffee.com/axrider"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer
                bg-[#ffdd00]/8 border border-[#ffdd00]/20 text-[#ffdd00]/80
                hover:bg-[#ffdd00]/15 hover:text-[#ffdd00] hover:border-[#ffdd00]/35"
            >
              <Coffee className="w-3 h-3" />
              Buy Me a Coffee
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
