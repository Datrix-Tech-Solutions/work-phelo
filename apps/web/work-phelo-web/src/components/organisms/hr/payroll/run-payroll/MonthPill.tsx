'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PayrollMonth {
  month: number;
  year: number;
}

const label = (m: PayrollMonth) =>
  new Date(m.year, m.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** This month and the twelve after it, latest first. Configurations can't be backdated, so testing means going forward. */
function recentMonths(now: Date): PayrollMonth[] {
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 12 - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
}

interface MonthPillProps {
  value: PayrollMonth;
  onChange: (value: PayrollMonth) => void;
}

/** The month being run, styled as a chip. Tapping it opens a list to run a different month. */
export function MonthPill({ value, onChange }: MonthPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-200"
      >
        {label(value)}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {recentMonths(new Date()).map((m) => {
            const selected = m.month === value.month && m.year === value.year;
            return (
              <li
                key={`${m.year}-${m.month}`}
                ref={selected ? selectedRef : undefined}
                role="option"
                aria-selected={selected}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!selected) onChange(m);
                  }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {label(m)}
                  {selected && <Check className="h-3.5 w-3.5 text-gray-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
