'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import {
  CONDITION_LABELS,
  PURPOSE_LABELS,
  REQUEST_STATUS_BADGES,
  describeReturn,
  formatClock,
  formatTravelDate,
  formatWindow,
} from '@/lib/requestOptions';
import { MapPin } from 'lucide-react';
import type { TransportRequest } from '@/types/marketing';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="text-sm text-gray-900 whitespace-pre-line">{children}</div>
    </div>
  );
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props {
  request: TransportRequest | null;
  onClose: () => void;
  /** Shows Approve / Reject for pending requests (the viewer holds the approve permission). */
  canReview: boolean;
  /** What the viewer may do to an approved or on-route trip. */
  canReschedule: boolean;
  canStart: boolean;
  canComplete: boolean;
  canCancel: boolean;
  /** Approving needs a vehicle and driver, so it opens the approval pop-up. */
  onApprove: (request: TransportRequest) => void;
  /** Rejecting asks for a reason, so it opens the rejection pop-up. */
  onReject: (request: TransportRequest) => void;
  /** Rescheduling is the approval pop-up again, with a date and times. */
  onReschedule: (request: TransportRequest) => void;
  /** Starting asks for the starting mileage, vehicle condition and real departure time. */
  onStart: (request: TransportRequest) => void;
  /** Completing asks for the real return time. */
  onComplete: (request: TransportRequest) => void;
  onCancel: (request: TransportRequest) => void;
}

export function RequestDetailPanel({
  request,
  onClose,
  canReview,
  canReschedule,
  canStart,
  canComplete,
  canCancel,
  onApprove,
  onReject,
  onReschedule,
  onStart,
  onComplete,
  onCancel,
}: Props) {
  const badge = request ? REQUEST_STATUS_BADGES[request.status] : null;
  const reviewing = canReview && request?.status === 'PENDING';
  const tripActions = !!request && (canReschedule || canStart || canComplete || canCancel);

  return (
    <SidePanel
      isOpen={!!request}
      onClose={onClose}
      title="Transport Request"
      description={request ? `Raised by ${request.requester.name}` : undefined}
      descriptionAction={badge ? <Badge label={badge.label} variant={badge.variant} /> : undefined}
      footer={
        request && reviewing ? (
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
        ) : request && tripActions && !reviewing ? (
          <div className="flex flex-wrap justify-end gap-3">
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => onCancel(request)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Cancel Trip
              </Button>
            )}
            {canReschedule && (
              <Button variant="outline" onClick={() => onReschedule(request)}>
                Reschedule
              </Button>
            )}
            {canStart && <Button onClick={() => onStart(request)}>Start Trip</Button>}
            {canComplete && <Button onClick={() => onComplete(request)}>Complete Trip</Button>}
          </div>
        ) : undefined
      }
    >
      {request && (
        <div className="flex flex-col gap-4">
          {request.status === 'ON_ROUTE' && request.completable && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-input px-3 py-2">
              {request.returnTime
                ? 'This trip is past its planned return time. Complete it once the vehicle is back, cancel it if nobody went, or reschedule it.'
                : 'This trip has no planned return time, so it stays out until it is completed. Complete it once the vehicle is back, or cancel it if nobody went.'}
            </p>
          )}

          <Field label="Requester">
            {request.requester.name}
            {request.requester.department ? ` · ${request.requester.department}` : ''}
          </Field>
          <Field label="Purpose">{PURPOSE_LABELS[request.purpose]}</Field>
          {/* Requests made before purpose became personal / marketing / operations keep their typed reason. */}
          {request.businessPurpose && <Field label="Details">{request.businessPurpose}</Field>}
          {request.stops.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Destinations
              </span>
              {request.stops.map((stop) => (
                <div
                  key={`${stop.kind}:${stop.refId}`}
                  className="rounded-xl border border-gray-200 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {stop.name}
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-tight text-gray-400">
                      {stop.kind === 'CLIENT' ? 'Client' : 'Prospect'}
                      {stop.source === 'VISITED' ? ' · added on completion' : ''}
                    </span>
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {stop.locationLabel}
                  </p>
                </div>
              ))}
            </div>
          ) : request.destination ? (
            <Field label="Destination">{request.destination}</Field>
          ) : null}
          <Field label="Travel Date">{formatTravelDate(request.travelDate)}</Field>
          <Field label="Departure – Return">
            {formatWindow(request.departureTime, request.returnTime)}
          </Field>
          {request.reschedule && (
            <Field label="Rescheduled">
              {`From ${formatTravelDate(request.reschedule.previous.travelDate)}${
                request.reschedule.previous.departureTime
                  ? ` ${formatWindow(request.reschedule.previous.departureTime, request.reschedule.previous.returnTime)}`
                  : ''
              }`}
              {request.reschedule.byName ? `\nBy ${request.reschedule.byName}` : ''}
              {request.reschedule.count > 1 ? ` (moved ${request.reschedule.count} times)` : ''}
            </Field>
          )}
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
              {request.review.byName ?? 'Unknown'} · {longDate(request.review.at)}
              {request.review.note ? `\n${request.review.note}` : ''}
            </Field>
          )}

          {request.start && (
            <Field label="Departed">
              {request.start.actualDepartureTime
                ? `${formatClock(request.start.actualDepartureTime)}${
                    request.start.minutesLate
                      ? ` · ${Math.abs(request.start.minutesLate)} min ${
                          request.start.minutesLate > 0 ? 'late' : 'early'
                        }`
                      : ''
                  }`
                : 'Not recorded'}
              {request.start.mileage !== null
                ? `\nStarting mileage ${request.start.mileage.toLocaleString('en-GB')}`
                : ''}
              {request.start.condition
                ? `\nVehicle condition ${CONDITION_LABELS[request.start.condition]}`
                : ''}
              {request.start.notes ? `\n${request.start.notes}` : ''}
              {`\nStarted by ${request.start.byName ?? 'Unknown'} · ${longDate(request.start.at)}`}
            </Field>
          )}

          {request.completion && (
            <Field label="Returned">
              {request.completion.actualReturnTime
                ? `${formatClock(request.completion.actualReturnTime)}${
                    describeReturn(request.completion.minutesLate)
                      ? ` · ${describeReturn(request.completion.minutesLate)}`
                      : ''
                  }`
                : 'Not recorded'}
              {request.completion.endingMileage !== null
                ? `\nEnding mileage ${request.completion.endingMileage.toLocaleString('en-GB')}${
                    request.completion.distance !== null
                      ? ` · ${request.completion.distance.toLocaleString('en-GB')} km covered`
                      : ''
                  }`
                : ''}
              {request.completion.endingCondition
                ? `\nReturn condition ${CONDITION_LABELS[request.completion.endingCondition]}`
                : ''}
              {request.completion.notes ? `\n${request.completion.notes}` : ''}
              {`\nCompleted by ${request.completion.byName ?? 'Unknown'} · ${longDate(request.completion.at)}`}
            </Field>
          )}
        </div>
      )}
    </SidePanel>
  );
}
