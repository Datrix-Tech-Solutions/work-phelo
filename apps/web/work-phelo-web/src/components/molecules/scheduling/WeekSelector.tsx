import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ── Shared week helpers ── */

export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friday.toLocaleDateString('en-US', opts)}`;
}

export const WEEKDAYS = [
  { label: 'MON', isoDay: 1 },
  { label: 'TUE', isoDay: 2 },
  { label: 'WED', isoDay: 3 },
  { label: 'THU', isoDay: 4 },
  { label: 'FRI', isoDay: 5 },
] as const;

/* ── Component ── */

interface WeekSelectorProps {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
}

export function WeekSelector({ weekStart, onPrev, onNext }: WeekSelectorProps) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-card bg-white px-4 py-2.5 shadow-sm shrink-0">
      <button
        onClick={onPrev}
        className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold text-gray-800 min-w-45 text-center">
        {formatWeekRange(weekStart)}
      </span>
      <button
        onClick={onNext}
        className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
        aria-label="Next week"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
