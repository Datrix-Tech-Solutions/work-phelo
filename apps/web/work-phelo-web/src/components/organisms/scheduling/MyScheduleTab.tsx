'use client';

import { useState, useMemo } from 'react';
import { WeekDayCard, DayShift, DayShiftType } from '@/components/molecules/scheduling/WeekDayCard';
import {
  WeekSelector,
  getMondayOf,
  addDays,
  toISODate,
} from '@/components/molecules/scheduling/WeekSelector';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useMyShiftSchedules } from '@/hooks/useScheduling';
import { Skeleton } from '@/components/atoms/Skeleton';

const WEEKDAYS = [
  { label: 'MON', isoDay: 1 },
  { label: 'TUE', isoDay: 2 },
  { label: 'WED', isoDay: 3 },
  { label: 'THU', isoDay: 4 },
  { label: 'FRI', isoDay: 5 },
];

export function MyScheduleTab() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [swapPanelOpen, setSwapPanelOpen] = useState(false);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const today = toISODate(new Date());

  const { data: schedules = [], isLoading } = useMyShiftSchedules();

  /* Build a date → DayShift[] map for the current week (multiple shifts per day supported) */
  const shiftsForWeek = useMemo(() => {
    const map: Record<string, DayShift[]> = {};

    for (const s of schedules) {
      for (const { isoDay } of WEEKDAYS) {
        const dayDate = addDays(weekStart, isoDay - 1);
        const date = toISODate(dayDate);
        const dow = dayDate.getDay();
        const from = s.effectiveFrom.slice(0, 10);
        const to = s.effectiveTo?.slice(0, 10) ?? null;

        if (s.dayOfWeek.includes(dow) && from <= date && (to === null || to >= date)) {
          if (!map[date]) map[date] = [];
          map[date].push({
            type: s.shiftType.toLowerCase() as DayShiftType,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
    }

    return map;
  }, [schedules, weekStart]);

  const handleCardClick = (isoDate: string) => {
    setSelectedDate((prev) => (prev === isoDate ? null : isoDate));
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* ── Week navigator ── */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-400">Your schedule for this week</p>
        <WeekSelector weekStart={weekStart} onPrev={prevWeek} onNext={nextWeek} />
      </div>

      {/* ── Day cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {WEEKDAYS.map(({ label }) => (
            <div
              key={label}
              className="flex flex-col rounded-2xl overflow-hidden border-2 border-gray-200"
            >
              {/* Header skeleton */}
              <div className="bg-gray-100 px-4 py-3 flex flex-col items-center gap-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              {/* Body skeleton */}
              <div className="flex flex-col flex-1 p-4 min-h-36 bg-white gap-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {WEEKDAYS.map(({ label, isoDay }) => {
            const dayDate = addDays(weekStart, isoDay - 1);
            const isoDate = toISODate(dayDate);

            return (
              <WeekDayCard
                key={label}
                day={label}
                date={dayDate.getDate()}
                isToday={isoDate === today}
                shifts={shiftsForWeek[isoDate] ?? []}
                isSelected={selectedDate === isoDate}
                onClick={() => handleCardClick(isoDate)}
                onSwapShift={() => setSwapPanelOpen(true)}
              />
            );
          })}
        </div>
      )}

      {/* ── Swap shift panel (blank) ── */}
      <SidePanel
        isOpen={swapPanelOpen}
        onClose={() => setSwapPanelOpen(false)}
        title="Swap Shift"
        description="Request a shift swap with a colleague"
      >
        <div />
      </SidePanel>
    </div>
  );
}
