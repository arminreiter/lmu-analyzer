import { useRef } from 'react';
import { FolderOpen, Upload, Shield, Zap, RotateCcw } from 'lucide-react';

interface FolderPickerProps {
  onFolderSelected: (handle: FileSystemDirectoryHandle) => void;
  onFilesUploaded: (files: File[]) => void;
  onResumeCached?: () => void;
  loading: boolean;
  error: string | null;
}

export function FolderPicker({ onFolderSelected, onFilesUploaded, onResumeCached, loading, error }: FolderPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSupported = 'showDirectoryPicker' in window;

  const handleFolderClick = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        id: 'lmu-results',
        startIn: 'desktop',
      });
      onFolderSelected(handle);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Failed to open folder:', e);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const xmlFiles = Array.from(fileList).filter(f => f.name.endsWith('.xml'));
    if (xmlFiles.length === 0) return;
    onFilesUploaded(xmlFiles);
  };

  const spinner = (
    <span className="flex items-center gap-3">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      ANALYZING...
    </span>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden scanline-overlay">
      {/* Background */}
      <div className="absolute inset-0 bg-racing-black" />
      <div className="absolute inset-0 checkered opacity-40" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #e10600, transparent 60%)' }}
      />
      {/* Top racing stripe */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-racing-red via-racing-red/60 to-racing-red/10" />
      {/* Bottom racing stripe */}
      <div className="absolute bottom-0 right-0 w-full h-[3px] bg-gradient-to-l from-racing-red via-racing-red/60 to-racing-red/10" />
      {/* Diagonal racing stripes — left */}
      <div className="absolute top-0 left-[10%] w-[2px] h-full opacity-[0.03] bg-racing-red" style={{ transform: 'rotate(15deg)', transformOrigin: 'top' }} />
      <div className="absolute top-0 left-[12%] w-[1px] h-full opacity-[0.02] bg-racing-red" style={{ transform: 'rotate(15deg)', transformOrigin: 'top' }} />
      {/* Diagonal racing stripes — right */}
      <div className="absolute top-0 right-[10%] w-[2px] h-full opacity-[0.03] bg-racing-red" style={{ transform: 'rotate(-15deg)', transformOrigin: 'top' }} />
      <div className="absolute top-0 right-[12%] w-[1px] h-full opacity-[0.02] bg-racing-red" style={{ transform: 'rotate(-15deg)', transformOrigin: 'top' }} />

      <div className="max-w-lg w-full text-center relative z-10">
        {/* Logo */}
        <div className="mb-10 animate-in animate-in-1">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="w-16 h-16 bg-racing-red flex items-center justify-center
              shadow-[0_0_50px_rgba(225,6,0,0.3)]"
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
              <span className="font-racing text-xl font-black text-[#fff] tracking-wider">LMU</span>
            </div>
          </div>
          <h1 className="font-racing text-3xl md:text-4xl font-black text-white mb-1 tracking-[0.15em]">
            ANALYZER
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-px flex-1 max-w-12 bg-gradient-to-r from-transparent to-racing-red/30" />
            <p className="text-racing-muted/80 text-[10px] tracking-[0.25em] uppercase">Race Data Intelligence</p>
            <div className="h-px flex-1 max-w-12 bg-gradient-to-l from-transparent to-racing-red/30" />
          </div>
        </div>

        {/* Main Card */}
        <div className="data-card carbon-fiber p-8 animate-in animate-in-2">
          <div className="mb-7">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5
              bg-racing-dark border border-racing-border">
              <FolderOpen className="w-6 h-6 text-racing-red" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Load Race Data</h2>
            <p className="text-racing-text text-sm leading-relaxed">
              {isSupported
                ? 'Select your results folder or upload XML files.'
                : 'Upload your LMU race result XML files.'}
            </p>
            <p className="text-racing-muted text-xs mt-1">All processing happens locally in your browser.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isSupported && (
              <button
                onClick={handleFolderClick}
                disabled={loading}
                className="px-6 py-3 bg-racing-red hover:bg-racing-red-dark disabled:opacity-50
                  text-[#fff] font-racing font-bold text-sm tracking-[0.1em]
                  transition-all shadow-[0_0_25px_rgba(225,6,0,0.25)]
                  hover:shadow-[0_0_40px_rgba(225,6,0,0.4)]
                  disabled:cursor-not-allowed cursor-pointer"
                style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
              >
                {loading ? spinner : (
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    OPEN FOLDER
                  </span>
                )}
              </button>
            )}

            {isSupported && <span className="text-racing-muted/30 text-xs font-mono">or</span>}

            <input ref={fileInputRef} type="file" multiple accept=".xml" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className={`px-6 py-3 disabled:opacity-50 font-racing font-bold text-sm tracking-[0.1em]
                transition-all disabled:cursor-not-allowed cursor-pointer
                ${isSupported
                  ? 'bg-racing-card border border-racing-border text-racing-muted hover:border-racing-red/30 hover:text-white'
                  : 'bg-racing-red hover:bg-racing-red-dark text-[#fff] shadow-[0_0_25px_rgba(225,6,0,0.25)]'
                }`}
              style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
            >
              {loading && !isSupported ? spinner : (
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  UPLOAD FILES
                </span>
              )}
            </button>
          </div>

          {onResumeCached && (
            <div className="mt-5 pt-5 border-t border-racing-border/30">
              <button
                onClick={onResumeCached}
                disabled={loading}
                className="px-6 py-3 bg-racing-card border border-racing-border text-racing-text hover:border-racing-green/30 hover:text-white
                  disabled:opacity-50 font-racing font-bold text-sm tracking-[0.1em]
                  transition-all disabled:cursor-not-allowed cursor-pointer"
                style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  RESUME LAST SESSION
                </span>
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 p-3 bg-racing-red/5 border border-racing-red/20 rounded-lg">
              <p className="text-racing-red text-sm">{error}</p>
            </div>
          )}

          <p className="mt-6 text-racing-muted/70 text-[10px] font-mono tracking-wide">
            DEFAULT: C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate\UserData\Log\Results
          </p>
        </div>

        {/* Trust */}
        <div className="flex items-center justify-center gap-5 mt-6 animate-in animate-in-3">
          <span className="flex items-center gap-1.5 text-racing-muted/70 text-[10px]">
            <Shield className="w-3 h-3" /> 100% Local
          </span>
          <span className="flex items-center gap-1.5 text-racing-muted/70 text-[10px]">
            <Zap className="w-3 h-3" /> No Server
          </span>
        </div>

        <p className="mt-6 text-racing-muted/50 text-[10px] animate-in animate-in-4">
          <a href="https://a31.at" target="_blank" rel="noopener noreferrer"
            className="hover:text-racing-red transition-colors">
            axrider &middot; a31 Labs
          </a>
        </p>
      </div>
    </div>
  );
}
