'use client';

import { cardClass } from '@/lib/utils';
import { useLeaveBalances, useLeaveTypes } from '@/hooks/hr/useLeave';
import { useParams } from 'next/navigation';
import type { LeaveBalance } from '@/types/hr';

interface Props {
  employeeId: string;
}

export function EmployeeLeaveBalancesSection({ employeeId }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: balancesRaw, isLoading } = useLeaveBalances(employeeId);
  const balances: LeaveBalance[] = Array.isArray(balancesRaw) ? balancesRaw : [];

  const { data: leaveTypes = [] } = useLeaveTypes(tenantSlug);
  const activeLeaveTypeIds = new Set(leaveTypes.filter((t) => t.isActive).map((t) => t.id));
  const eligible = balances.filter((b) => b.entitled > 0 && activeLeaveTypeIds.has(b.leaveTypeId));

  if (isLoading) return null;

  return (
    <div className={cardClass('overflow-hidden')}>
      <div className="border-b border-gray-100 px-6 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Leave Balances</h3>
      </div>
      {eligible.length === 0 ? (
        <p className="px-6 py-5 text-sm text-gray-400">No eligible leave types.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 px-6 py-5">
          {eligible.map((balance) => {
            const pct = Math.min(100, (balance.used / balance.entitled) * 100);
            return (
              <div
                key={balance.leaveTypeId}
                className="flex flex-col gap-2 p-4 rounded-2xl border border-gray-200 bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {balance.leaveTypeName}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">{balance.entitled} days/yr</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    <span className="font-semibold text-gray-900">{balance.remaining}</span>{' '}
                    remaining
                  </span>
                  <span className="text-gray-400">{balance.used} used</span>
                </div>
                {(balance.pending > 0 || balance.carriedOver > 0) && (
                  <p className="text-xs truncate">
                    {balance.pending > 0 && (
                      <span className="text-orange-500">
                        {balance.pending} day{balance.pending !== 1 ? 's' : ''} pending
                      </span>
                    )}
                    {balance.pending > 0 && balance.carriedOver > 0 && (
                      <span className="text-gray-300"> · </span>
                    )}
                    {balance.carriedOver > 0 && (
                      <span className="text-blue-500">{balance.carriedOver} carried over</span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
