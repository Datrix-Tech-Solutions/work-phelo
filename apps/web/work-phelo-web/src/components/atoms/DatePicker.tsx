'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerProps {
  label?: string;
  value?: string; // ISO: YYYY-MM-DD
  onChange?: (value: string) => void;
  error?: string;
  placeholder?: string;
  disableFuture?: boolean;
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD/MM/YYYY',
  disableFuture,
}: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months'>('days');
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView('days');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`
    : '';

  /* calendar grid */
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isFutureDay = (day: number) => {
    if (!disableFuture) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return d > t;
  };

  const isFutureMonth = (year: number, month: number) => {
    if (!disableFuture) return false;
    return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
  };

  const canGoNextMonth =
    !disableFuture ||
    !isFutureMonth(
      viewMonth === 11 ? viewYear + 1 : viewYear,
      viewMonth === 11 ? 0 : viewMonth + 1,
    );

  const canGoNextYear = !disableFuture || viewYear < today.getFullYear();

  const selectDay = (day: number) => {
    if (isFutureDay(day)) return;
    const d = new Date(viewYear, viewMonth, day);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange?.(iso);
    setOpen(false);
    setView('days');
  };

  const selectMonth = (monthIdx: number) => {
    if (isFutureMonth(viewYear, monthIdx)) return;
    setViewMonth(monthIdx);
    setView('days');
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Input trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 border rounded-input bg-white text-sm transition-colors focus:outline-none',
          'focus:ring-1 focus:ring-gray-400 focus:border-gray-400',
          error ? 'border-red-500' : 'border-gray-300',
          displayValue ? 'text-gray-900' : 'text-gray-400',
        )}
      >
        <span>{displayValue || placeholder}</span>
        <span className="text-gray-400">
          <CalendarIcon />
        </span>
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Calendar popup */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          {view === 'days' ? (
            <>
              {/* Month/year header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => setView('months')}
                  className="flex items-center gap-1.5 text-sm font-bold text-[#0D2244] hover:opacity-70 transition-opacity"
                >
                  {MONTHS[viewMonth]} {viewYear}
                  <ChevronDown />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    disabled={!canGoNextMonth}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      canGoNextMonth
                        ? 'hover:bg-gray-100 text-gray-600'
                        : 'text-gray-200 cursor-not-allowed',
                    )}
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 px-3 pb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const isSelected =
                    parsed &&
                    parsed.getDate() === day &&
                    parsed.getMonth() === viewMonth &&
                    parsed.getFullYear() === viewYear;
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() === viewMonth &&
                    today.getFullYear() === viewYear;
                  const future = isFutureDay(day);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectDay(day)}
                      disabled={future}
                      className={cn(
                        'h-8 w-full text-sm rounded-lg transition-colors',
                        future
                          ? 'text-gray-200 cursor-not-allowed'
                          : isSelected
                            ? 'bg-[#0D2244] text-white font-semibold'
                            : isToday
                              ? 'border border-[#0D2244] text-[#0D2244] font-semibold'
                              : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Month/year picker — simple nav, no fixed range */
            <div className="p-4">
              {/* Year navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                >
                  <ChevronLeft />
                </button>
                <span className="text-sm font-bold text-[#0D2244]">{viewYear}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (canGoNextYear) setViewYear((y) => y + 1);
                  }}
                  disabled={!canGoNextYear}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    canGoNextYear
                      ? 'hover:bg-gray-100 text-gray-600'
                      : 'text-gray-200 cursor-not-allowed',
                  )}
                >
                  <ChevronRight />
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-1">
                {MONTHS.map((m, idx) => {
                  const futureM = isFutureMonth(viewYear, idx);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMonth(idx)}
                      disabled={futureM}
                      className={cn(
                        'py-2 text-xs rounded-lg transition-colors',
                        futureM
                          ? 'text-gray-200 cursor-not-allowed'
                          : idx === viewMonth && viewYear === (parsed?.getFullYear() ?? -1)
                            ? 'bg-[#0D2244] text-white font-semibold'
                            : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
