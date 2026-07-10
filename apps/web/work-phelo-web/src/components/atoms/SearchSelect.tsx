'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
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
  /** 'md' (default) keeps the standard py-3 height; 'sm' matches the DataTable search input (py-2). */
  size?: 'sm' | 'md';
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
  size = 'md',
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updateDropdownPos = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
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

  const selected = options.find((o) => o.value === value);

  /* What the input shows:
     - when open: whatever the user is typing (query)
     - when closed: the selected label or empty */
  const inputDisplay = open ? query : (selected?.label ?? '');

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

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const handleFocus = () => {
    openDropdown();
    setQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) openDropdown();
  };

  const handleSelect = (opt: SearchSelectOption) => {
    onChange?.(opt.value);
    closeDropdown();
    setQuery('');
  };

  const handleChevronClick = () => {
    if (open) {
      closeDropdown();
      setQuery('');
    } else {
      openDropdown();
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
    closeDropdown();
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Combobox input */}
      <div
        className={cn(
          'flex items-center border rounded-input px-4 transition-colors',
          open
            ? 'bg-white border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : error
              ? 'bg-white/90 backdrop-blur-sm border-red-500'
              : 'bg-white/90 backdrop-blur-sm border-(--module-border,var(--color-gray-300))',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputDisplay}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            'flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0',
            size === 'sm' ? 'py-2' : 'py-3',
          )}
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
            <div className={popupClass('min-h-0 overflow-hidden')}>
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
                          ? 'bg-brand-tint text-brand font-medium'
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
          </div>,
          document.body,
        )}
    </div>
  );
}
