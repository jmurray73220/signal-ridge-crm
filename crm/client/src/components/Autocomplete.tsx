import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Single-select typeahead with a dropdown of items. Free-text not allowed —
// use TagInput-style components when you want add-anything behaviour.
export function AutocompleteField({
  label,
  placeholder,
  items,
  value,
  onChange,
  renderItem,
  filterFn,
  required,
}: {
  label: string;
  placeholder: string;
  items: { id: string; display: string }[];
  value: string;
  onChange: (id: string) => void;
  renderItem?: (item: { id: string; display: string }) => React.ReactNode;
  filterFn?: (item: { id: string; display: string }, query: string) => boolean;
  required?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find(i => i.id === value);

  useEffect(() => {
    if (selected) setSearch(selected.display);
    else setSearch('');
  }, [value, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? items.filter(i =>
        filterFn ? filterFn(i, search) : i.display.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="label">
          {label}{required && ' *'}
        </label>
      )}
      <input
        className="input"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {filtered.slice(0, 20).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id);
                setSearch(item.display);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{
                color: item.id === value ? '#c9a84c' : '#e6edf3',
                background: item.id === value ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderBottom: '1px solid #30363d',
              }}
            >
              {renderItem ? renderItem(item) : item.display}
            </button>
          ))}
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setSearch(''); }}
          className="absolute right-2 top-[calc(50%+4px)] text-xs"
          style={{ color: '#8b949e' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
