'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { TableButton } from '@/components/atoms/TableButton';
import { CancelLeaveModal } from '@/components/organisms/dashboard/CancelLeaveModal';
import { formatDateRange } from '@/lib/formatters';
import type { LeaveRequest } from '@/types/hr';

interface PendingLeavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Requests still awaiting a decision — the only ones that can be withdrawn. */
  requests: LeaveRequest[];
}

export function PendingLeavePanel({ isOpen, onClose, requests }: PendingLeavePanelProps) {
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={onClose}
        title="Pending Requests"
        description="Requests awaiting approval. Cancel one if you no longer need it."
        width="sm:w-[480px]"
      >
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <p className="text-sm text-gray-400">No pending requests</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-4 border border-gray-200 rounded-card bg-white"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {r.leaveTypeName ?? 'Leave'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateRange(r.startDate, r.endDate)}
                  </p>
                </div>
                <TableButton variant="red" onClick={() => setCancelTarget(r)}>
                  Cancel
                </TableButton>
              </div>
            ))}
          </div>
        )}
      </SidePanel>

      <CancelLeaveModal request={cancelTarget} onClose={() => setCancelTarget(null)} />
    </>
  );
}
