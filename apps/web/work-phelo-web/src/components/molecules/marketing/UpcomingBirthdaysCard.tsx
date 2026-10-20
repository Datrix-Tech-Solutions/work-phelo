'use client';

import { Cake } from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useMarketingUpcomingBirthdays } from '@/hooks/marketing/useMarketingUpcomingBirthdays';
import { cardClass, cn, waterIconStyle } from '@/lib/utils';

const COLORS = { CLIENT: '#ec4899', PROSPECT: '#8b5cf6' } as const;
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

interface Props {
  userId?: string;
  className?: string;
}

/** Birthdays of client and prospect contact persons coming up. A live look-ahead, so it ignores
 * the period filter. */
export function UpcomingBirthdaysCard({ userId, className }: Props) {
  const { data, isLoading, isError } = useMarketingUpcomingBirthdays(userId);
  const birthdays = data?.birthdays ?? [];

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Birthdays</h3>
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
            Upcoming birthdays could not be loaded.
          </div>
        ) : birthdays.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No upcoming birthdays.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {birthdays.map((b) => {
              const color = COLORS[b.type];
              return (
                <li key={b.id} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={waterIconStyle(color)}
                  >
                    <Cake
                      className="w-3.5 h-3.5"
                      style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-xs font-semibold text-gray-900">
                      {b.contactName}
                    </span>
                    <span className="truncate text-[10px] text-gray-400">
                      {b.companyName} · {b.type === 'CLIENT' ? 'Client' : 'Prospect'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end leading-tight">
                    <span className="text-[11px] font-semibold text-gray-700">
                      {whenLabel(b.date)}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(b.date)}</span>
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
