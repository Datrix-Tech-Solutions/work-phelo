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
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD/MM/YYYY',
  disableFuture = false,
  disablePast = false,
}: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

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

  const isFutureDay = (day: number) =>
    disableFuture && new Date(viewYear, viewMonth, day) > todayNorm;
  const isPastDay = (day: number) => disablePast && new Date(viewYear, viewMonth, day) < todayNorm;
  const isDisabledDay = (day: number) => isFutureDay(day) || isPastDay(day);

  const selectDay = (day: number) => {
    if (isDisabledDay(day)) return;
    const d = new Date(viewYear, viewMonth, day);
    const iso = d.toISOString().split('T')[0];
    onChange?.(iso);
    setOpen(false);
    setView('days');
  };

  const selectMonth = (monthIdx: number) => {
    setViewMonth(monthIdx);
    setView('days');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setView('months');
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(!open)}
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
        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          {/* Days View */}
          {view === 'days' && (
            <>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button
                  onClick={() => setView('months')}
                  className="flex items-center gap-1.5 text-sm font-bold text-[#0D2244] hover:opacity-70 transition-opacity"
                >
                  {MONTHS[viewMonth]} {viewYear}
                  <ChevronDown className="w-4 h-4" />
                </button>

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
                        'h-9 w-9 text-sm rounded-lg transition-all',
                        disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-[#0D2244] text-white font-semibold shadow-sm'
                            : isCurrentDay
                              ? 'border-2 border-[#0D2244] text-[#0D2244] font-medium'
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

          {/* Months View */}
          {view === 'months' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setView('years')}
                  className="text-sm font-bold text-[#0D2244] flex items-center gap-1 hover:underline"
                >
                  {viewYear} <ChevronDown className="w-4 h-4" />
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewYear((y) => y - 1)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewYear((y) => y + 1)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((month, idx) => (
                  <button
                    key={month}
                    onClick={() => selectMonth(idx)}
                    className={cn(
                      'py-3 text-sm rounded-lg transition-colors',
                      idx === viewMonth
                        ? 'bg-[#0D2244] text-white font-medium'
                        : 'hover:bg-gray-100 text-gray-700',
                    )}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Years View */}
          {view === 'years' && (
            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 20 }, (_, i) => viewYear - 10 + i).map((year) => (
                  <button
                    key={year}
                    onClick={() => selectYear(year)}
                    className={cn(
                      'py-3 text-sm rounded-lg font-medium transition-colors',
                      year === viewYear
                        ? 'bg-[#0D2244] text-white shadow-sm'
                        : 'hover:bg-gray-100 text-gray-800 hover:text-gray-900',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
