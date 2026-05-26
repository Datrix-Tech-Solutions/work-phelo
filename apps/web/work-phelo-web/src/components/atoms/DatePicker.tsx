'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerProps {
  label?: string;
  value?: string; // ISO: YYYY-MM-DD
  onChange?: (value: string) => void;
  error?: string;
  placeholder?: string;
  disableFuture?: boolean;
  disablePast?: boolean;
  minDate?: string; // ISO: YYYY-MM-DD — disables all days before this date
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD/MM/YYYY',
  disableFuture = false,
  disablePast = false,
  minDate,
}: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = parsed?.getFullYear() ?? today.getFullYear();
    return Math.floor(y / 9) * 9;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open]);

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

  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const minDateNorm = minDate
    ? (() => {
        const d = new Date(minDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })()
    : null;

  const isDisabledDay = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (disableFuture && date > todayNorm) return true;
    if (disablePast && date < todayNorm) return true;
    if (minDateNorm && date < minDateNorm) return true;
    return false;
  };

  // A month is disabled if no selectable day exists within it
  const isDisabledMonth = (monthIdx: number) => {
    const firstDay = new Date(viewYear, monthIdx, 1);
    const lastDay = new Date(viewYear, monthIdx + 1, 0);
    if (disableFuture && firstDay > todayNorm) return true;
    if (disablePast && lastDay < todayNorm) return true;
    if (minDateNorm && lastDay < minDateNorm) return true;
    return false;
  };

  // A year is disabled if no selectable day exists within it
  const isDisabledYear = (year: number) => {
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    if (disableFuture && firstDay > todayNorm) return true;
    if (disablePast && lastDay < todayNorm) return true;
    if (minDateNorm && lastDay < minDateNorm) return true;
    return false;
  };

  const selectDay = (day: number) => {
    if (isDisabledDay(day)) return;
    const iso = new Date(viewYear, viewMonth, day).toISOString().split('T')[0];
    onChange?.(iso);
    setOpen(false);
    setView('days');
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const yearGrid = Array.from({ length: 9 }, (_, i) => yearPageStart + i);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setView('days');
        }}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          error ? 'border-red-500' : 'border-gray-300',
          displayValue ? 'text-gray-900' : 'text-gray-400',
        )}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar className="w-5 h-5 text-gray-400" />
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden"
        >
          {/* ── Days view ── */}
          {view === 'days' && (
            <>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setView('months')}
                    className="flex items-center gap-1 text-sm font-bold text-brand hover:opacity-70 transition-opacity px-1 py-1 rounded-lg hover:bg-gray-100"
                  >
                    {MONTHS[viewMonth]}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setYearPageStart(Math.floor(viewYear / 9) * 9);
                      setView('years');
                    }}
                    className="flex items-center gap-1 text-sm font-bold text-brand hover:opacity-70 transition-opacity px-1 py-1 rounded-lg hover:bg-gray-100"
                  >
                    {viewYear}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-xs text-gray-500 py-2 px-3 border-b">
                {DAYS.map((d) => (
                  <div key={d} className="text-center font-medium">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 p-3">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="h-9" />;
                  const disabled = isDisabledDay(day);
                  const isSelected =
                    parsed &&
                    parsed.getDate() === day &&
                    parsed.getMonth() === viewMonth &&
                    parsed.getFullYear() === viewYear;
                  const isCurrentDay =
                    today.getDate() === day &&
                    today.getMonth() === viewMonth &&
                    today.getFullYear() === viewYear;

                  return (
                    <button
                      key={i}
                      onClick={() => selectDay(day)}
                      disabled={disabled}
                      className={cn(
                        'h-9 w-full text-sm rounded-lg transition-all',
                        disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-brand text-white font-semibold shadow-sm'
                            : isCurrentDay
                              ? 'border-2 border-brand text-brand font-medium'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Months view ── */}
          {view === 'months' && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setView('days')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-brand">{viewYear}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((month, idx) => {
                  const disabled = isDisabledMonth(idx);
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        if (disabled) return;
                        setViewMonth(idx);
                        setView('days');
                      }}
                      disabled={disabled}
                      className={cn(
                        'py-3 text-sm rounded-lg transition-colors font-medium',
                        disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : idx === viewMonth
                            ? 'bg-brand text-white'
                            : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Years view ── */}
          {view === 'years' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setYearPageStart((s) => s - 9)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-brand">
                  {yearPageStart} – {yearPageStart + 8}
                </span>
                <button
                  onClick={() => setYearPageStart((s) => s + 9)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {yearGrid.map((year) => {
                  const disabled = isDisabledYear(year);
                  return (
                    <button
                      key={year}
                      onClick={() => {
                        if (disabled) return;
                        setViewYear(year);
                        setView('days');
                      }}
                      disabled={disabled}
                      className={cn(
                        'py-3 text-sm rounded-lg transition-colors font-medium',
                        disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : year === viewYear
                            ? 'bg-brand text-white'
                            : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {year}
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
