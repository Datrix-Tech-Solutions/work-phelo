'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { REQUEST_STATUS_BADGES, formatClock, formatTravelDate } from '@/lib/requestOptions';
import type { TransportRequest } from '@/types/marketing';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="text-sm text-gray-900 whitespace-pre-line">{children}</div>
    </div>
  );
}

interface Props {
  request: TransportRequest | null;
  onClose: () => void;
  /** Shows Approve / Reject for pending requests (the viewer holds the approve permission). */
  canReview: boolean;
  /** Approving needs a vehicle and driver, so it opens the approval pop-up. */
  onApprove: (request: TransportRequest) => void;
  /** Rejecting asks for a reason, so it opens the rejection pop-up. */
  onReject: (request: TransportRequest) => void;
}

export function RequestDetailPanel({ request, onClose, canReview, onApprove, onReject }: Props) {
  function handleClose() {
    onClose();
  }

  const showActions = canReview && request?.status === 'PENDING';
  const badge = request ? REQUEST_STATUS_BADGES[request.status] : null;

  return (
    <SidePanel
      isOpen={!!request}
      onClose={handleClose}
      title="Transport Request"
      description={request ? `Raised by ${request.requester.name}` : undefined}
      descriptionAction={badge ? <Badge label={badge.label} variant={badge.variant} /> : undefined}
      footer={
        showActions && request ? (
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onReject(request)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Reject
            </Button>
            <Button onClick={() => onApprove(request)}>Approve</Button>
          </div>
        ) : undefined
      }
    >
      {request && (
        <div className="flex flex-col gap-4">
          <Field label="Requester">
            {request.requester.name}
            {request.requester.department ? ` · ${request.requester.department}` : ''}
          </Field>
          <Field label="Business Purpose">{request.businessPurpose}</Field>
          <Field label="Destination">{request.destination}</Field>
          <Field label="Travel Date">{formatTravelDate(request.travelDate)}</Field>
          <Field label="Departure – Return">
            {formatClock(request.departureTime)} – {formatClock(request.returnTime)}
          </Field>
          <Field label="Passengers">
            {request.passengers.length === 0
              ? 'None'
              : request.passengers
                  .map((p) => (p.department ? `${p.name} (${p.department})` : p.name))
                  .join('\n')}
          </Field>
          {request.notes && <Field label="Notes">{request.notes}</Field>}

          {request.allocation && (
            <>
              <Field label="Vehicle">
                {request.allocation.vehicle.name ?? 'Unknown'}
                {request.allocation.vehicle.assetNumber
                  ? ` · ${request.allocation.vehicle.assetNumber}`
                  : ''}
              </Field>
              <Field label="Driver">
                {request.allocation.driver.selfDriven
                  ? `Self-driven (${request.allocation.driver.name ?? request.requester.name})`
                  : (request.allocation.driver.name ?? 'Unknown')}
              </Field>
            </>
          )}

          {request.review && (
            <Field label={request.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}>
              {request.review.byName ?? 'Unknown'} ·{' '}
              {new Date(request.review.at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
              {request.review.note ? `\n${request.review.note}` : ''}
            </Field>
          )}
        </div>
      )}
    </SidePanel>
  );
}
