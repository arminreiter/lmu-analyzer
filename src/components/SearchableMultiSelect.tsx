import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: React.ReactNode;
  detail?: string;
}

export interface QuickAction {
  label: string;
  onSelect: () => void;
}

interface SearchableMultiSelectProps {
  values: string[];
  options: MultiSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  quickActions?: QuickAction[];
  sortSelectedFirst?: boolean;
}

export function SearchableMultiSelect({ values, options, onChange, placeholder = 'Select...', icon, quickActions, sortSelectedFirst = false }: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = options
    .filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortSelectedFirst) return 0;
      const aSelected = values.includes(a.value);
      const bSelected = values.includes(b.value);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return 0;
    });

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const selectAll = () => onChange(options.map(o => o.value));
  const selectNone = () => onChange([]);

  const displayText = values.length === 0
    ? placeholder
    : values.length === 1
      ? options.find(o => o.value === values[0])?.label ?? values[0]
      : `${values.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-racing-card border border-racing-border
          rounded-lg text-sm text-racing-text hover:border-racing-highlight transition-colors cursor-pointer"
      >
        {icon}
        <span className="max-w-[200px] truncate">{displayText}</span>
        <ChevronDown className="w-3 h-3 text-racing-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-72 w-max max-w-[400px] bg-racing-card border border-racing-border
          rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Search */}
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
            {search && (
              <button onClick={() => setSearch('')} className="cursor-pointer">
                <X className="w-3 h-3 text-racing-muted hover:text-white" />
              </button>
            )}
          </div>

          {/* Select all / quick actions / clear */}
          <div className="flex gap-2 px-3 py-1.5 border-b border-racing-border text-xs">
            <button onClick={selectAll} className="text-racing-muted hover:text-white transition-colors cursor-pointer">
              Select all
            </button>
            {quickActions?.map(action => (
              <span key={action.label} className="contents">
                <span className="text-racing-border">|</span>
                <button onClick={action.onSelect} className="text-racing-muted hover:text-white transition-colors cursor-pointer">
                  {action.label}
                </button>
              </span>
            ))}
            <span className="text-racing-border">|</span>
            <button onClick={selectNone} className="text-racing-muted hover:text-white transition-colors cursor-pointer">
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map(o => {
              const selected = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-racing-highlight/50 transition-colors
                    flex items-center justify-between cursor-pointer
                    ${selected ? 'bg-racing-red/10' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                      ${selected ? 'bg-racing-red border-racing-red' : 'border-racing-border'}`}>
                      {selected && <Check className="w-3 h-3 text-[#fff]" />}
                    </span>
                    {o.badge}
                    <span className={selected ? 'text-racing-red' : 'text-racing-text'}>{o.label}</span>
                  </span>
                  {o.detail && (
                    <span className="text-racing-muted text-xs">{o.detail}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-racing-muted">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
