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
import { cn } from '@/lib/utils';
import type { TransportRequest } from '@/types/marketing';

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  /** Takes the full row instead of one of the two columns. */
  wide?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 min-w-0', wide && 'col-span-2')}>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="text-[13px] leading-snug text-gray-900 whitespace-pre-line wrap-break-word">
        {children}
      </div>
    </div>
  );
}

/** A titled group of fields laid out two to a row. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest">{title}</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
    </section>
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
        <div className="flex flex-col gap-3">
          {request.status === 'ON_ROUTE' && request.completable && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-input px-3 py-2">
              {request.returnTime
                ? 'This trip is past its planned return time. Complete it once the vehicle is back, cancel it if nobody went, or reschedule it.'
                : 'This trip has no planned return time, so it stays out until it is completed. Complete it once the vehicle is back, or cancel it if nobody went.'}
            </p>
          )}

          <Section title="Trip">
            <Field label="Requester">
              {request.requester.name}
              {request.requester.department ? ` · ${request.requester.department}` : ''}
            </Field>
            <Field label="Purpose">
              {PURPOSE_LABELS[request.purpose]}
              {/* Requests made before purpose became personal / marketing / operations keep their typed reason. */}
              {request.businessPurpose ? `\n${request.businessPurpose}` : ''}
            </Field>
            <Field label="Travel Date">{formatTravelDate(request.travelDate)}</Field>
            <Field label="Departure – Return">
              {formatWindow(request.departureTime, request.returnTime)}
            </Field>
            <Field label="Passengers">
              {request.passengers.length === 0
                ? 'None'
                : request.passengers
                    .map((p) => (p.department ? `${p.name} (${p.department})` : p.name))
                    .join('\n')}
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
            {request.notes && (
              <Field label="Notes" wide>
                {request.notes}
              </Field>
            )}
          </Section>

          <Section title={request.stops.length > 1 ? 'Destinations' : 'Destination'}>
            {request.stops.length > 0 ? (
              request.stops.map((stop) => (
                <div
                  key={`${stop.kind}:${stop.refId}`}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 min-w-0"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {stop.name}
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-tight text-gray-400">
                      {stop.kind === 'CLIENT' ? 'Client' : 'Prospect'}
                      {stop.source === 'VISITED' ? ' · added on completion' : ''}
                    </span>
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {stop.locationLabel}
                  </p>
                </div>
              ))
            ) : (
              <Field label="Destination" wide>
                {request.destination || '—'}
              </Field>
            )}
          </Section>

          {(request.allocation || request.review) && (
            <Section title="Allocation">
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
                <Field label={request.status === 'REJECTED' ? 'Rejected by' : 'Approved by'} wide>
                  {request.review.byName ?? 'Unknown'} · {longDate(request.review.at)}
                  {request.review.note ? `\n${request.review.note}` : ''}
                </Field>
              )}
            </Section>
          )}

          {request.start && (
            <Section title="Departure">
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
              </Field>
              <Field label="Started by">
                {request.start.byName ?? 'Unknown'} · {longDate(request.start.at)}
              </Field>
              {request.start.mileage !== null && (
                <Field label="Starting mileage">
                  {request.start.mileage.toLocaleString('en-GB')}
                </Field>
              )}
              {request.start.condition && (
                <Field label="Condition">{CONDITION_LABELS[request.start.condition]}</Field>
              )}
              {request.start.notes && (
                <Field label="Notes" wide>
                  {request.start.notes}
                </Field>
              )}
            </Section>
          )}

          {request.completion && (
            <Section title="Return">
              <Field label="Returned">
                {request.completion.actualReturnTime
                  ? `${formatClock(request.completion.actualReturnTime)}${
                      describeReturn(request.completion.minutesLate)
                        ? ` · ${describeReturn(request.completion.minutesLate)}`
                        : ''
                    }`
                  : 'Not recorded'}
              </Field>
              <Field label="Completed by">
                {request.completion.byName ?? 'Unknown'} · {longDate(request.completion.at)}
              </Field>
              {request.completion.endingMileage !== null && (
                <Field label="Ending mileage">
                  {request.completion.endingMileage.toLocaleString('en-GB')}
                </Field>
              )}
              {request.completion.distance !== null && (
                <Field label="Distance covered">
                  {request.completion.distance.toLocaleString('en-GB')} km
                </Field>
              )}
              {request.completion.endingCondition && (
                <Field label="Return condition">
                  {CONDITION_LABELS[request.completion.endingCondition]}
                </Field>
              )}
              {request.completion.notes && (
                <Field label="Notes" wide>
                  {request.completion.notes}
                </Field>
              )}
            </Section>
          )}
        </div>
      )}
    </SidePanel>
  );
}
