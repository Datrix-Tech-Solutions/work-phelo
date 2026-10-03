'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import {
  useApproveRequest,
  useRequestAllocationOptions,
  useRescheduleRequest,
} from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';
import { inputClass } from '@/lib/utils';
import type { AllocationBlock, TransportRequest } from '@/types/marketing';

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

const BLOCK_TAGS: Record<AllocationBlock, string> = {
  MAINTENANCE: 'Under maintenance',
  OVERDUE: 'On a trip',
  BOOKED: 'Booked',
};

const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

interface Props {
  /** The request being approved or rescheduled; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  /** Rescheduling is approving again with a new date and times. */
  mode?: 'approve' | 'reschedule';
  onClose: () => void;
}

export function ApproveRequestModal({ request, mode = 'approve', onClose }: Props) {
  if (!request) return null;
  // Keyed by request and mode so the form starts fresh each time it opens.
  return (
    <ApproveForm key={`${request.id}-${mode}`} request={request} mode={mode} onClose={onClose} />
  );
}

function ApproveForm({
  request,
  mode,
  onClose,
}: {
  request: TransportRequest;
  mode: 'approve' | 'reschedule';
  onClose: () => void;
}) {
  const toast = useToast();
  const approve = useApproveRequest();
  const reschedule = useRescheduleRequest();
  const isReschedule = mode === 'reschedule';
  const isPending = approve.isPending || reschedule.isPending;

  // Rescheduling starts from how the trip is allocated now.
  const current = isReschedule ? request.allocation : null;
  const [travelDate, setTravelDate] = useState(request.travelDate);
  const [departureTime, setDepartureTime] = useState(request.departureTime);
  const [returnTime, setReturnTime] = useState(request.returnTime);
  const [vehicleAssetId, setVehicleAssetId] = useState(current?.vehicle.assetId ?? '');
  const [driverEmployeeId, setDriverEmployeeId] = useState(
    current && !current.driver.selfDriven ? (current.driver.employeeId ?? '') : '',
  );
  const [selfDriven, setSelfDriven] = useState(current?.driver.selfDriven ?? false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{
    date?: string;
    departure?: string;
    return?: string;
    vehicle?: string;
    driver?: string;
  }>({});

  // Availability is worked out for the date and times being chosen, so it follows edits to them.
  const windowValid = !!travelDate && !!departureTime && !!returnTime && returnTime > departureTime;
  const { data: options } = useRequestAllocationOptions(
    request.id,
    !isReschedule || windowValid,
    isReschedule && windowValid ? { travelDate, departureTime, returnTime } : undefined,
  );

  // Unavailable vehicles and drivers stay in the list, greyed out and tagged with why,
  // after the ones that can be picked.
  const vehicleOptions = useMemo(
    () =>
      (options?.vehicles ?? [])
        .map((v) => ({
          value: v.assetId,
          label: v.name,
          sublabel:
            v.available || v.unavailableKind === 'MAINTENANCE'
              ? v.assetNumber
              : `${v.assetNumber} · ${v.unavailableReason}`,
          disabled: !v.available,
          tag: v.unavailableKind ? BLOCK_TAGS[v.unavailableKind] : undefined,
        }))
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
          tag: d.unavailableKind ? BLOCK_TAGS[d.unavailableKind] : undefined,
        }))
        .sort((a, b) => Number(a.disabled) - Number(b.disabled)),
    [options],
  );

  // A choice that stops being available (e.g. after moving the date) is dropped, not submitted.
  const pickedVehicle = vehicleOptions.some((o) => o.value === vehicleAssetId && !o.disabled)
    ? vehicleAssetId
    : '';
  const pickedDriver = driverOptions.some((o) => o.value === driverEmployeeId && !o.disabled)
    ? driverEmployeeId
    : '';

  function handleSubmit() {
    const next: typeof errors = {};
    if (isReschedule) {
      if (!travelDate) next.date = 'Travel date is required.';
      if (!departureTime) next.departure = 'Departure time is required.';
      if (!returnTime) next.return = 'Return time is required.';
      if (departureTime && returnTime && returnTime <= departureTime) {
        next.return = 'Return time must be after the departure time.';
      }
    }
    if (!pickedVehicle) next.vehicle = 'Select a vehicle.';
    if (!selfDriven && !pickedDriver) {
      next.driver = 'Select a driver, or mark the trip as self-driven.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const allocation = {
      vehicleAssetId: pickedVehicle,
      ...(selfDriven ? { selfDriven: true } : { driverEmployeeId: pickedDriver }),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const done = {
      onSuccess: () => {
        toast.success(isReschedule ? 'Trip rescheduled' : 'Request approved');
        onClose();
      },
      onError: (error: unknown) =>
        toast.error(
          apiErrorMessage(
            error,
            isReschedule ? 'Failed to reschedule trip' : 'Failed to approve request',
          ),
        ),
    };

    if (isReschedule) {
      reschedule.mutate(
        { id: request.id, ...allocation, travelDate, departureTime, returnTime },
        done,
      );
    } else {
      approve.mutate({ id: request.id, ...allocation }, done);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={isPending ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div
            className={
              isReschedule
                ? 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0'
                : 'w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0'
            }
          >
            {isReschedule ? (
              <CalendarClock className="w-5 h-5 text-blue-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {isReschedule ? 'Reschedule Trip' : 'Approve Request'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {request.requester.name} · {request.destination}
              {isReschedule
                ? ` · now ${formatTravelDate(request.travelDate)} ${formatClock(request.departureTime)}–${formatClock(request.returnTime)}`
                : ` · ${formatTravelDate(request.travelDate)} ${formatClock(request.departureTime)}–${formatClock(request.returnTime)}`}
            </p>
          </div>
        </div>

        {isReschedule && (
          <>
            <DatePicker
              label="Travel Date"
              value={travelDate}
              onChange={setTravelDate}
              error={errors.date}
              minDate={todayIso()}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Departure</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className={inputClass(errors.departure)}
                />
                {errors.departure && <p className="text-xs text-red-500">{errors.departure}</p>}
              </div>
              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Return</label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className={inputClass(errors.return)}
                />
                {errors.return && <p className="text-xs text-red-500">{errors.return}</p>}
              </div>
            </div>
          </>
        )}

        <SearchSelect
          label="Vehicle"
          placeholder={options ? 'Select a vehicle' : 'Loading vehicles…'}
          options={vehicleOptions}
          value={pickedVehicle}
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
              value={pickedDriver}
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
            placeholder={
              isReschedule ? 'Why the trip is being moved…' : 'Anything the requester should know…'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaClass}
          />
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isPending}
            loadingText={isReschedule ? 'Rescheduling…' : 'Approving…'}
          >
            {isReschedule ? 'Reschedule' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
