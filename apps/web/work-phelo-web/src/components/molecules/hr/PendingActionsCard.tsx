'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CalendarClock,
  CalendarOff,
  ClipboardCheck,
  FileSignature,
  Hourglass,
  LogOut,
  Repeat,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { usePendingActions } from '@/hooks/hr/useEmployeeDashboard';
import { cardClass, cn, waterIconStyle } from '@/lib/utils';
import type { PendingActions } from '@/types/hr';

interface ActionRow {
  key: keyof Omit<PendingActions, 'endingWithinDays'>;
  label: (data: PendingActions) => string;
  icon: LucideIcon;
  color: string;
  /** Path under `/{tenantSlug}/hr`. */
  path: string;
}

const ROWS: ActionRow[] = [
  {
    key: 'leaveRequests',
    label: () => 'Leave requests to review',
    icon: CalendarOff,
    color: '#eda100',
    path: '/leave/requests',
  },
  {
    key: 'timeCorrections',
    label: () => 'Time corrections to review',
    icon: Hourglass,
    color: '#2a78d6',
    path: '/time-clock?tab=corrections',
  },
  {
    key: 'shiftSwaps',
    label: () => 'Shift swaps awaiting a manager',
    icon: Repeat,
    color: '#06b6d4',
    path: '/scheduling',
  },
  {
    key: 'resignations',
    label: () => 'Resignations to act on',
    icon: LogOut,
    color: '#e34948',
    path: '/employees',
  },
  {
    key: 'payrollApprovals',
    label: () => 'Payroll runs awaiting approval',
    icon: Wallet,
    color: '#1baf7a',
    path: '/payroll/approve',
  },
  {
    key: 'appraisalFinalizations',
    label: () => 'Appraisals to finalise',
    icon: ClipboardCheck,
    color: '#a855f7',
    path: '/appraisal/hr-review',
  },
  {
    key: 'probationEnding',
    label: (d) => `Probations ending in ${d.endingWithinDays} days`,
    icon: CalendarClock,
    color: '#eb6834',
    path: '/employees',
  },
  {
    key: 'contractsEnding',
    label: (d) => `Contracts ending in ${d.endingWithinDays} days`,
    icon: FileSignature,
    color: '#ec4899',
    path: '/employees',
  },
];

interface PendingActionsCardProps {
  className?: string;
}

/** What is waiting on HR right now, each row linking to where it is handled. A live snapshot,
 * so it ignores the period filter. Rows with nothing waiting are dimmed and sorted last. */
export function PendingActionsCard({ className }: PendingActionsCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = usePendingActions();

  const rows = data
    ? ROWS.map((row, index) => ({ row, index, count: data[row.key] })).sort(
        (a, b) => Number(b.count > 0) - Number(a.count > 0) || a.index - b.index,
      )
    : [];
  const total = rows.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">Pending Actions</h3>
          <span className="text-xs text-gray-400">Waiting on HR</span>
        </div>
        {data && total > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            {total}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Pending actions could not be loaded.
          </div>
        ) : data && total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            You&apos;re all caught up.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map(({ row, count }) => {
              const Icon = row.icon;
              const waiting = count > 0;
              return (
                <li key={row.key}>
                  <Link
                    href={`/${tenantSlug}/hr${row.path}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-gray-100/70',
                      !waiting && 'opacity-50',
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={waterIconStyle(row.color)}
                    >
                      <Icon
                        className="w-3.5 h-3.5"
                        style={{ color: `color-mix(in oklab, ${row.color} 65%, black)` }}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                      {data ? row.label(data) : ''}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        waiting ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
