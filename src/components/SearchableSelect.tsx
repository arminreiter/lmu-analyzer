import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useClickOutside } from '../lib/useClickOutside';

interface SearchableSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ value, options, onChange, placeholder = 'Select...', className = '' }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeDropdown = useCallback(() => { setOpen(false); setSearch(''); }, []);
  useClickOutside(ref, closeDropdown);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 w-full bg-racing-card border border-racing-border
          rounded-lg px-3 py-1.5 text-sm text-racing-text hover:border-racing-highlight transition-colors cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-3 h-3 text-racing-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-full w-max max-w-[400px] bg-racing-card border border-racing-border
          rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-racing-border">
            <Search className="w-3 h-3 text-racing-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-racing-text outline-none placeholder:text-racing-muted/50"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-racing-highlight/50 transition-colors cursor-pointer
                  ${o.value === value ? 'bg-racing-red/10 text-racing-red' : 'text-racing-text'}`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-racing-muted">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
