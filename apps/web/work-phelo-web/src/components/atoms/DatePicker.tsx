'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Range of years to show in the picker
const YEAR_RANGE_BACK = 80;
const YEAR_RANGE_FORWARD = 10;

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
  const [view, setView] = useState<'days' | 'monthYear'>('days');
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedYearRef = useRef<HTMLButtonElement>(null);

  // Scroll the selected year into view whenever the monthYear panel opens
  useEffect(() => {
    if (view === 'monthYear') {
      setTimeout(() => {
        selectedYearRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    }
  }, [view]);

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

  const currentYear = today.getFullYear();
  const years = Array.from(
    { length: YEAR_RANGE_BACK + YEAR_RANGE_FORWARD },
    (_, i) => currentYear - YEAR_RANGE_BACK + i + 1,
  );

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
        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          {/* ── Days view ── */}
          {view === 'days' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button
                  onClick={() => setView('monthYear')}
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

              {/* Day labels */}
              <div className="grid grid-cols-7 text-xs text-gray-500 py-2 px-3 border-b">
                {DAYS.map((d) => (
                  <div key={d} className="text-center font-medium">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
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

          {/* ── Month + Year combined view ── */}
          {view === 'monthYear' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
                <button
                  onClick={() => setView('days')}
                  className="flex items-center gap-1.5 text-sm font-bold text-[#0D2244] hover:opacity-70 transition-opacity"
                >
                  {MONTHS[viewMonth]} {viewYear}
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </button>
              </div>

              <div className="flex" style={{ height: '280px' }}>
                {/* Left: months grid */}
                <div className="flex-1 p-3 border-r border-gray-100">
                  <p className="text-xs text-gray-400 font-medium mb-2 px-1">Month</p>
                  <div className="grid grid-cols-3 gap-1">
                    {MONTHS.map((month, idx) => (
                      <button
                        key={month}
                        onClick={() => {
                          setViewMonth(idx);
                          setView('days');
                        }}
                        className={cn(
                          'py-2 text-sm rounded-lg transition-colors font-medium',
                          idx === viewMonth
                            ? 'bg-[#0D2244] text-white'
                            : 'hover:bg-gray-100 text-gray-700',
                        )}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: scrollable years list */}
                <div className="w-24 overflow-y-auto">
                  <p className="text-xs text-gray-400 font-medium px-3 pt-3 pb-2 sticky top-0 bg-white">
                    Year
                  </p>
                  {years.map((year) => {
                    const isSelected = year === viewYear;
                    return (
                      <button
                        key={year}
                        ref={isSelected ? selectedYearRef : undefined}
                        onClick={() => {
                          setViewYear(year);
                          setView('days');
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 text-sm transition-colors',
                          isSelected
                            ? 'bg-[#EEF1F8] text-[#0D2244] font-bold'
                            : 'text-gray-700 hover:bg-gray-50',
                        )}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
