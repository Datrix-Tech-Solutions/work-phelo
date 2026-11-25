'use client';

import type { Period } from '@/components/atoms/PeriodToggle';
import { Avatar } from '@/components/atoms/Avatar';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useOnLeave } from '@/hooks/hr/useDashboard';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';

interface OnLeavePanelProps {
  tenantSlug: string;
  isOpen: boolean;
  onClose: () => void;
  period: Period;
  year: number;
}

/** Who was on approved leave in the dashboard's period. */
export function OnLeavePanel({ tenantSlug, isOpen, onClose, period, year }: OnLeavePanelProps) {
  const { data = [], isLoading, isError } = useOnLeave(period, year, { enabled: isOpen });
  const { fromDate, toDate } = dashboardRanges(period, year);

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title="On Leave"
      description={`Approved leave, ${formatDay(fromDate)} – ${formatDay(toDate)}`}
      expandHref={`/${tenantSlug}/hr/dashboard/on-leave?period=${period}&year=${year}`}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-gray-400 text-center py-10">Leave could not be loaded.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">
          No one is on leave in this period.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3">
              <Avatar name={entry.employeeName} avatarUrl={entry.avatarUrl} size={32} />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {entry.employeeName}
                </span>
                <span className="truncate text-xs text-gray-400">
                  {[entry.leaveType, entry.department].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                {formatDay(entry.startDate)} – {formatDay(entry.endDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardDrilldownPanel>
  );
}
