'use client';

import { Avatar } from '@/components/atoms/Avatar';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useOutToday } from '@/hooks/hr/useEmployeeDashboard';
import { cardClass, cn } from '@/lib/utils';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

interface OutTodayCardProps {
  className?: string;
}

/** Who is on approved leave today, and until when. A live snapshot, so it ignores the period
 * filter. */
export function OutTodayCard({ className }: OutTodayCardProps) {
  const { data, isLoading, isError } = useOutToday();
  const out = data?.out ?? [];

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">Out Today</h3>
          <span className="text-xs text-gray-400">On approved leave</span>
        </div>
        {data && out.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            {out.length}
          </span>
        )}
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
            Leave could not be loaded.
          </div>
        ) : out.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Everyone is in today.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {out.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2.5">
                <Avatar name={entry.employeeName} avatarUrl={entry.avatarUrl} size={28} />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-xs font-semibold text-gray-900">
                    {entry.employeeName}
                  </span>
                  <span className="truncate text-[10px] text-gray-400">
                    {[entry.leaveType, entry.department].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-gray-400">
                  until {formatDate(entry.endDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
