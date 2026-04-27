'use client';

import { useState } from 'react';
import { SwapRequestCard, SwapRequest } from '@/components/molecules/scheduling/SwapRequestCard';

const REQUESTS: SwapRequest[] = [];

const STATUS_FILTERS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

export function SwapRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loadingId, setLoadingId] = useState<{ id: string; action: 'approve' | 'reject' } | null>(
    null,
  );

  const filtered = REQUESTS.filter((r) => r.status === statusFilter);

  const handleApprove = (id: string) => {
    setLoadingId({ id, action: 'approve' });
  };

  const handleReject = (id: string) => {
    setLoadingId({ id, action: 'reject' });
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
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No {statusFilter.toLowerCase()} swap requests
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {filtered.map((request) => (
            <SwapRequestCard
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onReject={handleReject}
              isApproving={loadingId?.id === request.id && loadingId.action === 'approve'}
              isRejecting={loadingId?.id === request.id && loadingId.action === 'reject'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
