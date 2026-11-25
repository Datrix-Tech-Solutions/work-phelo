'use client';

import type { Period } from '@/components/atoms/PeriodToggle';
import { Avatar } from '@/components/atoms/Avatar';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useHiresAndExits } from '@/hooks/hr/useDashboard';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';
import type { MovementEntry } from '@/types/hr';

interface HiresExitsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  period: Period;
  year: number;
}

function MovementSection({
  title,
  entries,
  emptyMessage,
}: {
  title: string;
  entries: MovementEntry[];
  emptyMessage: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">
        {title} <span className="text-gray-400">({entries.length})</span>
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.employeeId} className="flex items-center gap-3">
              <Avatar name={entry.employeeName} avatarUrl={entry.avatarUrl} size={32} />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {entry.employeeName}
                </span>
                <span className="truncate text-xs text-gray-400">
                  {[entry.jobTitle, entry.department].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className="shrink-0 text-xs text-gray-500">{formatDay(entry.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Who joined and who left in the dashboard's period. */
export function HiresExitsPanel({ isOpen, onClose, period, year }: HiresExitsPanelProps) {
  const { data, isLoading, isError } = useHiresAndExits(period, year, { enabled: isOpen });
  const { fromDate, toDate } = dashboardRanges(period, year);

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Hires & Exits"
      description={`${formatDay(fromDate)} – ${formatDay(toDate)}`}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-gray-400 text-center py-10">
          Hires and exits could not be loaded.
        </p>
      ) : (
        data && (
          <>
            <MovementSection
              title="Hires"
              entries={data.hires}
              emptyMessage="No one joined in this period."
            />
            <MovementSection
              title="Exits"
              entries={data.exits}
              emptyMessage="No one left in this period."
            />
          </>
        )
      )}
    </DashboardDrilldownPanel>
  );
}
