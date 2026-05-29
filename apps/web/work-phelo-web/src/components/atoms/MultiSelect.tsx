'use client';

import { useState, useRef, useEffect } from 'react';
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
  hideChips?: boolean;
}

export function MultiSelect({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
  hideChips = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && dropdownRef.current)
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const selected = options.filter((o) => value.includes(o.value));

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Selected chips */}
      {!hideChips && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-xs font-medium px-2 py-1 rounded-full"
            >
              {opt.label}
              <button
                type="button"
                onClick={() => toggle(opt.value)}
                className="hover:text-orange-800 transition-colors"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : error ? 'border-red-500' : 'border-gray-300',
        )}
      >
        <span className={selected.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
          {selected.length > 0 ? 'Add more…' : placeholder}
        </span>
        <Icons.ChevronDown
          className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No options found</p>
            ) : (
              options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(opt.value)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                      )}
                    >
                      {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
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
