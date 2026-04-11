import type { ReactNode } from 'react';

interface PillSelectorProps<T> {
  items: T[];
  itemKey: (item: T) => string;
  selected: string | null;
  onSelect: (key: string) => void;
  children: (item: T) => ReactNode;
}

export function PillSelector<T>({ items, itemKey, selected, onSelect, children }: PillSelectorProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map(item => {
        const key = itemKey(item);
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer
              ${key === selected
                ? 'bg-racing-red text-[#fff]'
                : 'bg-racing-card border border-racing-border text-racing-muted hover:text-white hover:border-racing-highlight'}`}
          >
            {children(item)}
          </button>
        );
      })}
    </div>
  );
}
