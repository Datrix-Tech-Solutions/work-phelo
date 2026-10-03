'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { useApproveRequest, useRequestAllocationOptions } from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';
import type { TransportRequest } from '@/types/marketing';

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

interface Props {
  /** The request being approved; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  onClose: () => void;
}

export function ApproveRequestModal({ request, onClose }: Props) {
  if (!request) return null;
  // Keyed by request so the form starts fresh each time it opens.
  return <ApproveForm key={request.id} request={request} onClose={onClose} />;
}

function ApproveForm({ request, onClose }: { request: TransportRequest; onClose: () => void }) {
  const toast = useToast();
  const approve = useApproveRequest();
  const { data: options } = useRequestAllocationOptions(request.id);

  const [vehicleAssetId, setVehicleAssetId] = useState('');
  const [driverEmployeeId, setDriverEmployeeId] = useState('');
  const [selfDriven, setSelfDriven] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ vehicle?: string; driver?: string }>({});

  // Unavailable vehicles and drivers stay in the list, greyed out and tagged with why,
  // after the ones that can be picked.
  const vehicleOptions = useMemo(
    () =>
      (options?.vehicles ?? [])
        .map((v) => {
          const underMaintenance = v.unavailableReason === 'Under maintenance';
          return {
            value: v.assetId,
            label: v.name,
            sublabel:
              v.available || underMaintenance
                ? v.assetNumber
                : `${v.assetNumber} · ${v.unavailableReason}`,
            disabled: !v.available,
            tag: v.available ? undefined : underMaintenance ? 'Under maintenance' : 'Booked',
          };
        })
        .sort((a, b) => Number(a.disabled) - Number(b.disabled)),
    [options],
  );
  const driverOptions = useMemo(
    () =>
      (options?.drivers ?? [])
        .map((d) => ({
          value: d.employeeId,
          label: d.name,
          sublabel: [d.department, d.unavailableReason].filter(Boolean).join(' · ') || undefined,
          disabled: !d.available,
          tag: d.available ? undefined : 'Booked',
        }))
        .sort((a, b) => Number(a.disabled) - Number(b.disabled)),
    [options],
  );

  function handleApprove() {
    const next: typeof errors = {};
    if (!vehicleAssetId) next.vehicle = 'Select a vehicle.';
    if (!selfDriven && !driverEmployeeId)
      next.driver = 'Select a driver, or mark the trip as self-driven.';
    setErrors(next);
    if (Object.keys(next).length) return;

    approve.mutate(
      {
        id: request.id,
        vehicleAssetId,
        ...(selfDriven ? { selfDriven: true } : { driverEmployeeId }),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Request approved');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to approve request')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={approve.isPending ? undefined : onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Approve Request</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {request.requester.name} · {request.destination} ·{' '}
              {formatTravelDate(request.travelDate)} {formatClock(request.departureTime)}–
              {formatClock(request.returnTime)}
            </p>
          </div>
        </div>

        <SearchSelect
          label="Vehicle"
          placeholder={options ? 'Select a vehicle' : 'Loading vehicles…'}
          options={vehicleOptions}
          value={vehicleAssetId}
          onChange={setVehicleAssetId}
          error={errors.vehicle}
        />

        <ToggleRow
          label="Self-driven"
          description={`${request.requester.name} drives, so no driver is assigned.`}
          enabled={selfDriven}
          onChange={(enabled) => {
            setSelfDriven(enabled);
            if (enabled) {
              setDriverEmployeeId('');
              setErrors((prev) => ({ ...prev, driver: undefined }));
            }
          }}
        />

        {!selfDriven && (
          <>
            <SearchSelect
              label="Driver"
              placeholder={options ? 'Select a driver' : 'Loading drivers…'}
              options={driverOptions}
              value={driverEmployeeId}
              onChange={setDriverEmployeeId}
              error={errors.driver}
            />
            {options && options.drivers.length === 0 && (
              <p className="text-xs text-amber-600 -mt-2">
                No transport officers yet. Add drivers under Transport Officers, or mark the trip as
                self-driven.
              </p>
            )}
          </>
        )}

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Note (optional)</label>
          <textarea
            rows={2}
            placeholder="Anything the requester should know…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaClass}
          />
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onClose} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button onClick={handleApprove} isLoading={approve.isPending} loadingText="Approving…">
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
