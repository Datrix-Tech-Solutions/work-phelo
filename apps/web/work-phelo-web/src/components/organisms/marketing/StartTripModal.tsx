'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useStartOptions, useStartRequest } from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import {
  CONDITION_OPTIONS,
  formatTravelDate,
  formatWindow,
  minutesBetween,
} from '@/lib/requestOptions';
import { cn, inputClass } from '@/lib/utils';
import type { TransportRequest, VehicleCondition } from '@/types/marketing';

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

interface Props {
  /** The trip being started; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  onClose: () => void;
}

export function StartTripModal({ request, onClose }: Props) {
  if (!request) return null;
  // Keyed by request so the form is prefilled afresh each time it opens.
  return <StartForm key={request.id} request={request} onClose={onClose} />;
}

type Errors = Partial<Record<'departure' | 'mileage' | 'condition', string>>;

function StartForm({ request, onClose }: { request: TransportRequest; onClose: () => void }) {
  const toast = useToast();
  const start = useStartRequest();
  const { data: options } = useStartOptions(request.id);

  // Until edited, each field shows what it is prefilled with once that has loaded.
  const [departureEdit, setDepartureEdit] = useState<string | null>(null);
  const [mileageEdit, setMileageEdit] = useState<number | null>(null);
  const [conditionEdit, setConditionEdit] = useState<VehicleCondition | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const departure = departureEdit ?? options?.now.time ?? '';
  const mileage = mileageEdit ?? options?.mileage ?? 0;
  const condition = conditionEdit ?? options?.condition ?? '';

  const minutesLate = departure ? minutesBetween(request.departureTime, departure) : null;

  function handleStart() {
    const next: Errors = {};
    if (!departure) next.departure = 'Enter the time the vehicle left.';
    if (!mileage) next.mileage = 'Enter the odometer reading.';
    if (!condition) next.condition = 'Select the vehicle condition.';
    setErrors(next);
    if (Object.keys(next).length) return;

    start.mutate(
      {
        id: request.id,
        actualDepartureTime: departure,
        startingMileage: mileage,
        startingCondition: condition as VehicleCondition,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Trip started');
          onClose();
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Failed to start trip')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={start.isPending ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Start Trip</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {[request.requester.name, request.destination, formatTravelDate(request.travelDate)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Planned {formatWindow(request.departureTime, request.returnTime)}
          {options?.vehicleName ? ` · ${options.vehicleName}` : ''}. The trip is on route from the
          moment it is started.
        </p>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Departure time</label>
          <input
            type="time"
            value={departure}
            onChange={(e) => setDepartureEdit(e.target.value)}
            className={inputClass(errors.departure)}
          />
          {errors.departure && <p className="text-xs text-red-500">{errors.departure}</p>}
          {!errors.departure && minutesLate !== null && minutesLate !== 0 && (
            <p
              className={cn(
                'text-xs font-medium',
                minutesLate > 0 ? 'text-amber-600' : 'text-green-600',
              )}
            >
              {Math.abs(minutesLate)} min {minutesLate > 0 ? 'later' : 'earlier'} than planned
            </p>
          )}
        </div>

        <NumberField
          label="Starting mileage"
          decimals={0}
          placeholder={options ? 'Odometer reading' : 'Loading…'}
          value={mileage}
          onChange={setMileageEdit}
          error={errors.mileage}
          className="w-full"
        />

        <SearchSelect
          label="Vehicle condition"
          placeholder={options ? 'Select the condition' : 'Loading…'}
          options={CONDITION_OPTIONS}
          value={condition}
          onChange={(v) => setConditionEdit((v || null) as VehicleCondition | null)}
          error={errors.condition}
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Notes (optional)</label>
          <textarea
            rows={3}
            placeholder="Fuel level, damage, anything worth recording…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={textareaClass}
          />
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onClose} disabled={start.isPending}>
            Cancel
          </Button>
          <Button onClick={handleStart} isLoading={start.isPending} loadingText="Starting…">
            Start Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
