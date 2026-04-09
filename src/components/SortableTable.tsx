import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => number | string | null;
  exportValue?: (row: T, index: number) => string | number | null;
  render: (row: T, index: number) => ReactNode;
  headerClass?: string;
  width?: string; // e.g. '40px', '15%', '8rem'
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  rowClass?: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  stickyRows?: ReactNode;
}

type SortDir = 'asc' | 'desc';

export function SortableTable<T>({ columns, data, rowKey, rowClass, onRowClick, stickyRows }: SortableTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortCol) return data;
    const col = columns.find(c => c.key === sortCol);
    if (!col?.sortValue) return data;
    const getValue = col.sortValue;
    return [...data].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [data, sortCol, sortDir, columns]);

  const hasWidths = columns.some(c => c.width);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={hasWidths ? { tableLayout: 'fixed' } : undefined}>
        {hasWidths && (
          <colgroup>
            {columns.map(col => (
              <col key={col.key} style={col.width ? { width: col.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="text-racing-muted text-[10px] uppercase tracking-wider border-b-2 border-racing-red/20 bg-racing-dark/50">
            {columns.map(col => {
              const isSorted = sortCol === col.key;
              const canSort = col.sortable !== false && col.sortValue;
              return (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    ${col.mono ? 'font-mono' : ''} ${col.headerClass ?? ''}
                    ${canSort ? 'cursor-pointer select-none hover:text-racing-text transition-colors group' : ''}`}
                  onClick={canSort ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {canSort && (
                      <span className={`inline-flex ${isSorted ? 'text-racing-red' : 'text-racing-muted/30 group-hover:text-racing-muted/60'} transition-colors`}>
                        {isSorted ? (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {stickyRows}
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={`border-b border-racing-border/20 hover:bg-racing-highlight/10 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClass?.(row, i) ?? ''}`}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-2 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    ${col.mono ? 'font-mono' : ''} ${!col.align || col.align === 'left' ? 'truncate' : ''}`}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
