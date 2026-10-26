'use client';

import { Cake, CalendarClock, FileSignature, PartyPopper, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useUpcomingEvents } from '@/hooks/hr/useEmployeeDashboard';
import { cardClass, cn, waterIconStyle } from '@/lib/utils';
import type { UpcomingEvent, UpcomingEventType } from '@/types/hr';

interface EventStyle {
  icon: LucideIcon;
  color: string;
  title: (event: UpcomingEvent) => string;
}

const EVENT_STYLES: Record<UpcomingEventType, EventStyle> = {
  BIRTHDAY: { icon: Cake, color: '#ec4899', title: () => 'Birthday' },
  WORK_ANNIVERSARY: {
    icon: PartyPopper,
    color: '#8b5cf6',
    title: (e) => `${e.years} ${e.years === 1 ? 'year' : 'years'} with the company`,
  },
  PROBATION_ENDS: { icon: CalendarClock, color: '#eb6834', title: () => 'Probation ends' },
  CONTRACT_ENDS: { icon: FileSignature, color: '#eda100', title: () => 'Contract ends' },
};

const DAY_MS = 86_400_000;

/** "Today", "Tomorrow", "in 5 days", counted in whole days from the user's local date. */
function whenLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const now = new Date();
  const days = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS,
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

interface UpcomingEventsCardProps {
  className?: string;
}

/** Birthdays, work anniversaries and probation or contract end dates coming up. A live
 * look-ahead, so it ignores the period filter. */
export function UpcomingEventsCard({ className }: UpcomingEventsCardProps) {
  const { data, isLoading, isError } = useUpcomingEvents();
  const events = (data?.events ?? []).filter((event) => event.type in EVENT_STYLES);

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Events</h3>
        <span className="text-xs text-gray-400">Next {data?.withinDays ?? 30} days</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Upcoming events could not be loaded.
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nothing coming up.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => {
              const style = EVENT_STYLES[event.type];
              const Icon = style.icon;
              return (
                <li key={event.id} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={waterIconStyle(style.color)}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: `color-mix(in oklab, ${style.color} 65%, black)` }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-xs font-semibold text-gray-900">
                      {event.employeeName}
                    </span>
                    <span className="truncate text-[10px] text-gray-400">
                      {[style.title(event), event.department].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end leading-tight">
                    <span className="text-[11px] font-semibold text-gray-700">
                      {whenLabel(event.date)}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(event.date)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
