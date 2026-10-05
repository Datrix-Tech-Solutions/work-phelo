'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { useRejectRequest } from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatTravelDate, formatWindow } from '@/lib/requestOptions';
import type { TransportRequest } from '@/types/marketing';

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

interface Props {
  /** The request being rejected; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  onClose: () => void;
}

export function RejectRequestModal({ request, onClose }: Props) {
  if (!request) return null;
  // Keyed by request so the reason starts empty each time it opens.
  return <RejectForm key={request.id} request={request} onClose={onClose} />;
}

function RejectForm({ request, onClose }: { request: TransportRequest; onClose: () => void }) {
  const toast = useToast();
  const reject = useRejectRequest();
  const [reason, setReason] = useState('');

  function handleReject() {
    reject.mutate(
      { id: request.id, note: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Request rejected');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to reject request')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={reject.isPending ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Reject Request</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {[
                request.requester.name,
                request.destination,
                `${formatTravelDate(request.travelDate)} ${formatWindow(request.departureTime, request.returnTime)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Reason (optional)</label>
          <textarea
            rows={3}
            placeholder="Tell the requester why this was rejected…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={textareaClass}
          />
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onClose} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            isLoading={reject.isPending}
            loadingText="Rejecting…"
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
