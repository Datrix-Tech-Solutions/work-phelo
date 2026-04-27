'use client';

import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';

export interface SwapRequestShift {
  date: string; // ISO "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface SwapRequestPerson {
  name: string;
  avatarUrl?: string;
}

export interface SwapRequest {
  id: string;
  requester: SwapRequestPerson;
  requesterShift: SwapRequestShift;
  target: SwapRequestPerson;
  targetShift: SwapRequestShift;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface Props {
  request: SwapRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name} className="w-14 h-14 rounded-full object-cover shrink-0" />
    );
  }

  return (
    <div className="w-14 h-14 rounded-full bg-[#2d1515] flex items-center justify-center shrink-0">
      <span className="text-white text-sm font-semibold">{initials}</span>
    </div>
  );
}

function ShiftBox({ person, shift }: { person: SwapRequestPerson; shift: SwapRequestShift }) {
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <Avatar name={person.name} avatarUrl={person.avatarUrl} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(shift.date)}</p>
        <p className="text-sm font-medium text-blue-600 mt-0.5">
          {shift.startTime} - {shift.endTime}
        </p>
      </div>
    </div>
  );
}

export function SwapRequestCard({ request, onApprove, onReject, isApproving, isRejecting }: Props) {
  const isPending = request.status === 'PENDING';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      {/* Shift boxes */}
      <div className="flex items-center gap-3">
        <ShiftBox person={request.requester} shift={request.requesterShift} />

        <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-4 h-4 text-gray-400" />
        </div>

        <ShiftBox person={request.target} shift={request.targetShift} />
      </div>

      {/* Reason */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Reason for Swap</p>
        <p className="text-sm text-gray-500 mt-1">{request.reason}</p>
      </div>

      {/* Actions — only shown for pending requests */}
      {isPending && (
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReject(request.id)}
            isLoading={isRejecting}
            loadingText="Rejecting..."
            disabled={isApproving}
          >
            Reject
          </Button>
          <Button
            size="sm"
            className="bg-[#0d1b3e] hover:bg-[#0d1b3e]/90 focus:ring-[#0d1b3e]"
            onClick={() => onApprove(request.id)}
            isLoading={isApproving}
            loadingText="Approving..."
            disabled={isRejecting}
          >
            Approve
          </Button>
        </div>
      )}

      {/* Status badge for non-pending */}
      {!isPending && (
        <div className="flex justify-end">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              request.status === 'APPROVED'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
          </span>
        </div>
      )}
    </div>
  );
}
