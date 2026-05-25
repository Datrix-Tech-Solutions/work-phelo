'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

export interface CreatableOption {
  value: string;
  label: string;
}

interface CreatableSearchSelectProps {
  label?: string;
  placeholder?: string;
  /** Pre-existing options to suggest (can be empty) */
  options?: CreatableOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <Icons.ChevronDown className={cn('transition-transform duration-150', open && 'rotate-180')} />
  );
}

export function CreatableSearchSelect({
  label,
  placeholder = 'Type to search or create…',
  options = [],
  value = '',
  onChange,
  error,
}: CreatableSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Sync display value when closed */
  const inputDisplay = open ? query : value;

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        /* Commit whatever is typed when user clicks away */
        if (query.trim()) onChange?.(query.trim());
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, onChange]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showCreate =
    query.trim().length > 0 &&
    !filtered.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  const handleFocus = () => {
    setOpen(true);
    setQuery(value); // pre-fill with current value so user can refine
  };

  const handleSelect = (val: string) => {
    onChange?.(val);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = () => {
    const trimmed = query.trim();
    if (trimmed) handleSelect(trimmed);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
    setOpen(false);
  };

  const handleChevronClick = () => {
    if (open) {
      setOpen(false);
      setQuery('');
    } else {
      setOpen(true);
      setQuery(value);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

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
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 py-3 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
        />

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
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

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  opt.value === value
                    ? 'bg-[#EEF1F8] text-brand font-medium'
                    : 'text-gray-900 hover:bg-gray-50',
                )}
              >
                {opt.label}
              </button>
            ))}

            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                className="w-full text-left px-4 py-2.5 text-sm text-brand hover:bg-[#EEF1F8] transition-colors flex items-center gap-2 border-t border-gray-100"
              >
                <Icons.Plus className="w-4 h-4 shrink-0" />
                <span>
                  Create <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
