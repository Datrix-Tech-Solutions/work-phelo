'use client';

import { useState } from 'react';
import { WeekDayCard, DayShift } from '@/components/molecules/scheduling/WeekDayCard';
import {
  WeekSelector,
  getMondayOf,
  addDays,
  toISODate,
} from '@/components/molecules/scheduling/WeekSelector';
import { SidePanel } from '@/components/organisms/shared/SidePanel';

const WEEKDAYS = [
  { label: 'MON', isoDay: 1 },
  { label: 'TUE', isoDay: 2 },
  { label: 'WED', isoDay: 3 },
  { label: 'THU', isoDay: 4 },
  { label: 'FRI', isoDay: 5 },
];

/* Placeholder — replace with API data when the endpoint is ready */
const MOCK_SHIFTS: Record<string, DayShift> = {};

export function MyScheduleTab() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [swapPanelOpen, setSwapPanelOpen] = useState(false);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const today = toISODate(new Date());

  const handleCardClick = (isoDate: string) => {
    setSelectedDate((prev) => (prev === isoDate ? null : isoDate));
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* ── Week navigator ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs text-gray-400">Your schedule for this week</p>
        </div>
        <WeekSelector weekStart={weekStart} onPrev={prevWeek} onNext={nextWeek} />
      </div>

      {/* ── Day cards ── */}
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
              shift={MOCK_SHIFTS[isoDate]}
              isSelected={selectedDate === isoDate}
              onClick={() => handleCardClick(isoDate)}
              onSwapShift={() => setSwapPanelOpen(true)}
            />
          );
        })}
      </div>

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
