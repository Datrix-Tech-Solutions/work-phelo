'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
}

export function MultiSelect({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label)
    .join(', ');

  const toggle = (optValue: string) => {
    onChange(value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue]);
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      <div
        className={cn(
          'flex items-center border rounded-input bg-white px-4 transition-colors cursor-pointer',
          open ? 'border-brand ring-1 ring-brand/20' : error ? 'border-red-500' : 'border-gray-300',
        )}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selectedLabels}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          readOnly={!open}
          className="flex-1 py-3 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 shrink-0 ml-2"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
        >
          <Icons.ChevronDown
            className={cn('transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>
            ) : (
              filtered.map((opt) => {
                const selected = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
                      selected
                        ? 'bg-[#EEF1F8] text-brand font-medium'
                        : 'text-gray-900 hover:bg-gray-300',
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center',
                        selected ? 'bg-brand border-brand' : 'border-gray-300',
                      )}
                    >
                      {selected && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 12 12"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
