'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
  hideChips?: boolean;
  /** 'md' (default) keeps the standard py-3 height; 'sm' matches the DataTable search input (py-2). */
  size?: 'sm' | 'md';
}

export function MultiSelect({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
  hideChips = false,
  size = 'sm',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updateDropdownPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [open]);

  useEffect(() => {
    if (!showDropdown || !open) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const openDropdown = () => {
    updateDropdownPos();
    setOpen(true);
    setShowDropdown(true);
  };

  const closeDropdown = () => {
    setOpen(false);
    setExpanded(false);
  };

  /* keep the dropdown mounted until its closing transition finishes */
  const handleDropdownTransitionEnd = (e: React.TransitionEvent) => {
    if (!open && e.propertyName === 'grid-template-rows') setShowDropdown(false);
  };

  /* close on outside click — dropdown is portaled to <body>, so it must be checked separately from containerRef */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
      setQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const selected = options.filter((o) => value.includes(o.value));

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const handleTriggerClick = () => {
    if (open) {
      closeDropdown();
      setQuery('');
    } else {
      openDropdown();
      setQuery('');
    }
  };

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

      {/* Trigger — same combobox styling as SearchSelect */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className={cn(
          'flex items-center justify-between px-4 border rounded-input transition-colors',
          size === 'sm' ? 'py-2' : 'py-3',
          open
            ? 'bg-white border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : error
              ? 'bg-white/90 backdrop-blur-sm border-red-500'
              : 'bg-white/90 backdrop-blur-sm border-(--module-border,var(--color-gray-300))',
        )}
      >
        <span className={cn('text-sm', selected.length > 0 ? 'text-gray-900' : 'text-gray-400')}>
          {selected.length > 0 ? 'Add more…' : placeholder}
        </span>
        <Icons.ChevronDown
          className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Dropdown — grid-rows trick animates height to fit actual content, so it flows down/up smoothly.
          Portaled to <body> so it isn't trapped inside a blurred/glass ancestor's stacking context. */}
      {showDropdown &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            onTransitionEnd={handleDropdownTransitionEnd}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              gridTemplateRows: expanded ? '1fr' : '0fr',
              opacity: expanded ? 1 : 0,
            }}
            className="z-50 grid transition-[grid-template-rows,opacity] duration-700 ease-in-out"
          >
            <div className={popupClass('min-h-0 overflow-hidden flex flex-col')}>
              <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 border border-gray-200 rounded-input px-3 py-1.5 bg-gray-50 focus-within:border-(--module-btn-bg,var(--color-brand)) focus-within:ring-1 focus-within:ring-(--module-btn-bg,var(--color-brand))/20 transition-colors">
                  <Icons.Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Search…"
                    className="flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
                  />
                  {query && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setQuery('')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Icons.X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>
                ) : (
                  filtered.map((opt) => {
                    const checked = value.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggle(opt.value)}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-300 text-left transition-colors"
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5',
                            checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                          )}
                        >
                          {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="flex flex-col min-w-0">
                          <span>{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
