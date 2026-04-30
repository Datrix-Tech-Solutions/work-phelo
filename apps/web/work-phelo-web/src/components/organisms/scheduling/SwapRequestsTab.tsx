'use client';

import { useState } from 'react';
import { SwapRequestCard, SwapRequest } from '@/components/molecules/scheduling/SwapRequestCard';
import { usePendingManagerShiftSwaps, useReviewShiftSwap } from '@/hooks/useScheduling';
import { ShiftSwapRequest } from '@/types/scheduling';
import { useToast } from '@/hooks/useToast';

const STATUS_FILTERS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

function toCardRequest(s: ShiftSwapRequest): SwapRequest {
  return {
    id: s.id,
    requester: {
      name: s.requesterEmployee
        ? `${s.requesterEmployee.firstName} ${s.requesterEmployee.lastName}`
        : 'Unknown',
    },
    requesterShift: {
      date: s.requesterShiftDate.slice(0, 10),
      startTime: s.requesterSchedule?.startTime ?? '',
      endTime: s.requesterSchedule?.endTime ?? '',
    },
    target: {
      name: s.targetEmployee
        ? `${s.targetEmployee.firstName} ${s.targetEmployee.lastName}`
        : 'Unknown',
    },
    targetShift: {
      date: s.targetShiftDate.slice(0, 10),
      startTime: s.targetSchedule?.startTime ?? '',
      endTime: s.targetSchedule?.endTime ?? '',
    },
    reason: s.reason ?? '',
    status: 'PENDING',
  };
}

export function SwapRequestsTab() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loadingId, setLoadingId] = useState<{ id: string; action: 'APPROVE' | 'REJECT' } | null>(
    null,
  );

  const { data: pendingSwaps = [], isLoading } = usePendingManagerShiftSwaps();
  const { mutate: reviewSwap } = useReviewShiftSwap();

  const requests =
    statusFilter === 'PENDING'
      ? pendingSwaps.filter((s) => s.status === 'PENDING_MANAGER').map(toCardRequest)
      : [];

  const handleApprove = (id: string) => {
    setLoadingId({ id, action: 'APPROVE' });
    reviewSwap(
      { shiftSwapId: id, payload: { action: 'APPROVE' } },
      {
        onSuccess: () => toast.success('Swap approved'),
        onSettled: () => setLoadingId(null),
      },
    );
  };

  const handleReject = (id: string) => {
    setLoadingId({ id, action: 'REJECT' });
    reviewSwap(
      { shiftSwapId: id, payload: { action: 'REJECT' } },
      {
        onSuccess: () => toast.success('Swap rejected'),
        onSettled: () => setLoadingId(null),
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-5 min-h-0">
      {/* Filter tabs */}
      <div className="flex gap-2 shrink-0">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              statusFilter === key
                ? 'bg-[#0d1b3e] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && statusFilter === 'PENDING' ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No {statusFilter.toLowerCase()} swap requests
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {requests.map((request) => (
            <SwapRequestCard
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onReject={handleReject}
              isApproving={loadingId?.id === request.id && loadingId.action === 'APPROVE'}
              isRejecting={loadingId?.id === request.id && loadingId.action === 'REJECT'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
