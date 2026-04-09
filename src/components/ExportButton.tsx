import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Column } from './SortableTable';

interface ExportButtonProps<T> {
  columns: Column<T>[];
  data: T[];
  filename: string;
}

type ExportFormat = 'csv' | 'json' | 'xlsx';

function getCellValue<T>(col: Column<T>, row: T, index: number): string | number | null {
  if (col.exportValue) return col.exportValue(row, index);
  if (col.sortValue) {
    const v = col.sortValue(row);
    return v;
  }
  return null;
}

function buildRows<T>(columns: Column<T>[], data: T[]): Record<string, string | number | null>[] {
  return data.map((row, i) => {
    const obj: Record<string, string | number | null> = {};
    for (const col of columns) {
      obj[col.label] = getCellValue(col, row, i);
    }
    return obj;
  });
}

function exportCSV<T>(columns: Column<T>[], data: T[], filename: string) {
  const headers = columns.map(c => c.label);
  const rows = data.map((row, i) =>
    columns.map(col => {
      const val = getCellValue(col, row, i);
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape CSV values containing commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  download(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

function exportJSON<T>(columns: Column<T>[], data: T[], filename: string) {
  const rows = buildRows(columns, data);
  const json = JSON.stringify(rows, null, 2);
  download(json, `${filename}.json`, 'application/json;charset=utf-8;');
}

function exportXLSX<T>(columns: Column<T>[], data: T[], filename: string) {
  const rows = buildRows(columns, data);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const formats: { key: ExportFormat; label: string }[] = [
  { key: 'csv', label: 'CSV' },
  { key: 'json', label: 'JSON' },
  { key: 'xlsx', label: 'Excel' },
];

export function ExportButton<T>({ columns, data, filename }: ExportButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = (format: ExportFormat) => {
    setOpen(false);
    switch (format) {
      case 'csv': exportCSV(columns, data, filename); break;
      case 'json': exportJSON(columns, data, filename); break;
      case 'xlsx': exportXLSX(columns, data, filename); break;
    }
  };

  if (data.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 ml-2 px-2.5 py-1 text-[11px] text-racing-muted hover:text-racing-text
          bg-racing-card hover:bg-racing-card-hover border border-racing-border/40 rounded
          transition-colors cursor-pointer"
        title="Export table"
      >
        <Download className="w-3 h-3" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-racing-card border border-racing-border/60 rounded shadow-lg min-w-[100px]">
          {formats.map(f => (
            <button
              key={f.key}
              onClick={() => handleExport(f.key)}
              className="block w-full text-left px-3 py-1.5 text-[11px] text-racing-muted hover:text-racing-text
                hover:bg-racing-highlight/30 transition-colors cursor-pointer first:rounded-t last:rounded-b"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
