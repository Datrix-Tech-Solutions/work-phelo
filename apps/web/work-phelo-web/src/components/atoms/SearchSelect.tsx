'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchSelectProps {
  label?: string;
  placeholder?: string;
  options: SearchSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <Icons.ChevronDown className={cn('transition-transform duration-150', open && 'rotate-180')} />
  );
}

export function SearchSelect({
  label,
  placeholder = 'Select or type to search…',
  options,
  value,
  onChange,
  error,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  /* What the input shows:
     - when open: whatever the user is typing (query)
     - when closed: the selected label or empty */
  const inputDisplay = open ? query : (selected?.label ?? '');

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const handleFocus = () => {
    setOpen(true);
    setQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  };

  const handleSelect = (opt: SearchSelectOption) => {
    onChange?.(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleChevronClick = () => {
    if (open) {
      setOpen(false);
      setQuery('');
    } else {
      setOpen(true);
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Combobox input */}
      <div
        className={cn(
          'flex items-center border rounded-input bg-white px-4 transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : error ? 'border-red-500' : 'border-gray-300',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputDisplay}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 py-3 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
        />

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Clear button — only when something is selected */}
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
          {/* Chevron toggle */}
          <button
            type="button"
            onClick={handleChevronClick}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
          >
            <ChevronDown open={open} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // prevent input blur before select fires
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors flex flex-col',
                    opt.value === value
                      ? 'bg-[#EEF1F8] text-brand font-medium'
                      : 'text-gray-900 hover:bg-gray-300',
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
