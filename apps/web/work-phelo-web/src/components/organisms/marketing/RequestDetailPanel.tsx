'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useApproveRequest,
  useRejectRequest,
  useRequestAllocationOptions,
} from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
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

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

interface Props {
  request: TransportRequest | null;
  onClose: () => void;
  /** Shows the allocation form and Approve / Reject for pending requests that aren't the viewer's own. */
  canReview: boolean;
}

export function RequestDetailPanel({ request, onClose, canReview }: Props) {
  const toast = useToast();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const isPending = approve.isPending || reject.isPending;

  const [vehicleAssetId, setVehicleAssetId] = useState('');
  const [driverEmployeeId, setDriverEmployeeId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ vehicle?: string; driver?: string }>({});

  const showActions = canReview && request?.status === 'PENDING';
  const { data: options } = useRequestAllocationOptions(request?.id, showActions);

  const vehicleOptions = useMemo(
    () =>
      (options?.vehicles ?? [])
        .filter((v) => v.available)
        .map((v) => ({ value: v.assetId, label: v.name, sublabel: v.assetNumber })),
    [options],
  );
  const driverOptions = useMemo(
    () =>
      (options?.drivers ?? [])
        .filter((d) => d.available)
        .map((d) => ({
          value: d.employeeId,
          label: d.name,
          sublabel: d.department ?? undefined,
        })),
    [options],
  );
  const unavailable = useMemo(
    () => ({
      vehicles: (options?.vehicles ?? []).filter((v) => !v.available),
      drivers: (options?.drivers ?? []).filter((d) => !d.available),
    }),
    [options],
  );

  function handleClose() {
    setVehicleAssetId('');
    setDriverEmployeeId('');
    setNote('');
    setErrors({});
    onClose();
  }

  function handleApprove() {
    if (!request) return;
    const next: typeof errors = {};
    if (!vehicleAssetId) next.vehicle = 'Select a vehicle.';
    if (!driverEmployeeId) next.driver = 'Select a driver.';
    setErrors(next);
    if (Object.keys(next).length) return;

    approve.mutate(
      {
        id: request.id,
        vehicleAssetId,
        driverEmployeeId,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Request approved');
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to approve request')),
      },
    );
  }

  function handleReject() {
    if (!request) return;
    reject.mutate(
      { id: request.id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Request rejected');
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to reject request')),
      },
    );
  }

  const badge = request ? REQUEST_STATUS_BADGES[request.status] : null;

  return (
    <SidePanel
      isOpen={!!request}
      onClose={handleClose}
      title="Transport Request"
      description={request ? `Raised by ${request.requester.name}` : undefined}
      descriptionAction={badge ? <Badge label={badge.label} variant={badge.variant} /> : undefined}
      footer={
        showActions ? (
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isPending}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Reject
            </Button>
            <Button onClick={handleApprove} isLoading={approve.isPending} loadingText="Saving…">
              Approve
            </Button>
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
              <Field label="Driver">{request.allocation.driver.name ?? 'Unknown'}</Field>
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

          {showActions && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">
                Allocation
              </p>

              <SearchSelect
                label="Vehicle"
                placeholder={options ? 'Select a vehicle' : 'Loading vehicles…'}
                options={vehicleOptions}
                value={vehicleAssetId}
                onChange={setVehicleAssetId}
                error={errors.vehicle}
              />
              {unavailable.vehicles.length > 0 && (
                <p className="text-xs text-gray-400 -mt-1">
                  Unavailable:{' '}
                  {unavailable.vehicles.map((v) => `${v.name} (${v.unavailableReason})`).join('; ')}
                </p>
              )}

              <SearchSelect
                label="Driver"
                placeholder={options ? 'Select a driver' : 'Loading drivers…'}
                options={driverOptions}
                value={driverEmployeeId}
                onChange={setDriverEmployeeId}
                error={errors.driver}
              />
              {options && options.drivers.length === 0 && (
                <p className="text-xs text-amber-600 -mt-1">
                  No transport officers yet. Add drivers under Transport Officers first.
                </p>
              )}
              {unavailable.drivers.length > 0 && (
                <p className="text-xs text-gray-400 -mt-1">
                  Unavailable:{' '}
                  {unavailable.drivers.map((d) => `${d.name} (${d.unavailableReason})`).join('; ')}
                </p>
              )}

              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Note (optional)</label>
                <textarea
                  rows={3}
                  placeholder="eg; reason for rejecting"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={textareaClass}
                />
              </div>
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
