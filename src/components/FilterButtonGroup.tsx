interface FilterButtonGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterButtonGroup<T extends string>({ options, value, onChange }: FilterButtonGroupProps<T>) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-racing-border text-xs font-medium w-fit">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 transition-colors cursor-pointer ${i > 0 ? 'border-l border-racing-border' : ''} ${value === opt.value ? 'bg-racing-red text-[#fff]' : 'bg-racing-card text-racing-muted hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
