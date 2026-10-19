'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { usePayrollStatus } from '@/hooks/hr/useEmployeeDashboard';
import { formatMoney } from '@/lib/formatMoney';
import { PAYSLIP_TYPES } from '@/lib/payroll-engine/constants';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { cardClass, cn } from '@/lib/utils';
import type { PayrollStatusRun } from '@/types/hr';

const STATUS: Record<
  PayrollStatusRun['status'],
  { label: string; variant: BadgeProps['variant'] }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'info' },
  PAID: { label: 'Paid', variant: 'success' },
};

function runLabel(payslipKey: string) {
  return (
    (PAYSLIP_TYPES as Record<string, { label: string } | undefined>)[payslipKey]?.label ?? 'Payroll'
  );
}

/** Where a run is handled, depending on how far along it is. Path under `/{tenantSlug}/hr`. */
function runPath(run: PayrollStatusRun) {
  if (run.status === 'PENDING_APPROVAL') return `/payroll/approve/${run.id}`;
  if (run.status === 'DRAFT') return '/payroll/manage';
  return `/payroll/history/${run.id}`;
}

interface PayrollStatusCardProps {
  className?: string;
}

/** The latest payroll period and how far each of its runs has got. A live snapshot, so it
 * ignores the period filter. Shown only to people who can read payroll. */
export function PayrollStatusCard({ className }: PayrollStatusCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = usePayrollStatus();

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Payroll</h3>
        <span className="text-xs text-gray-400">
          {data?.period ? payrollMonthLabel(data.period.month, data.period.year) : 'Latest period'}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Payroll could not be loaded.
          </div>
        ) : !data?.period ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No payroll has been run yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.runs.map((run) => {
              const status = STATUS[run.status];
              return (
                <li key={run.id}>
                  <Link
                    href={`/${tenantSlug}/hr${runPath(run)}`}
                    className="flex flex-col gap-1 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-gray-100/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-gray-900">
                        {runLabel(run.payslipKey)}
                      </span>
                      <Badge label={status.label} variant={status.variant} />
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-gray-400">
                        {run.employees} {run.employees === 1 ? 'employee' : 'employees'}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">
                        {data.currency} {formatMoney(run.totalNet)}
                      </span>
                    </div>
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
