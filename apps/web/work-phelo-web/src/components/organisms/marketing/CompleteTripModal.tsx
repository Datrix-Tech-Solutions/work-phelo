'use client';

import { useState } from 'react';
import { Flag, MapPin } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { useCompleteRequest } from '@/hooks/marketing/useRequests';
import { useDestinationPicker } from '@/hooks/marketing/useDestinationPicker';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import {
  describeReturn,
  formatClock,
  formatTravelDate,
  formatWindow,
  minutesBetween,
} from '@/lib/requestOptions';
import { cn, inputClass } from '@/lib/utils';
import type { TransportRequest } from '@/types/marketing';

interface Props {
  /** The trip being completed; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  onClose: () => void;
}

export function CompleteTripModal({ request, onClose }: Props) {
  if (!request) return null;
  // Keyed by request so the form starts from the planned return each time it opens.
  return <CompleteForm key={request.id} request={request} onClose={onClose} />;
}

function CompleteForm({ request, onClose }: { request: TransportRequest; onClose: () => void }) {
  const toast = useToast();
  const complete = useCompleteRequest();
  // Starts as the return time chosen when the request was made, if there was one; change it to the real one.
  const [actualReturnTime, setActualReturnTime] = useState(request.returnTime ?? '');
  const [error, setError] = useState('');
  // Places already on the trip can't be added again.
  const visited = useDestinationPicker(
    [],
    request.stops.map((stop) => ({ kind: stop.kind, id: stop.refId })),
  );

  // With no planned return time there is nothing to be early or late against.
  const minutesLate =
    actualReturnTime && request.returnTime
      ? minutesBetween(request.returnTime, actualReturnTime)
      : null;
  const verdict = describeReturn(minutesLate);

  function handleComplete() {
    if (!actualReturnTime) {
      setError('Enter the time the vehicle got back.');
      return;
    }
    if (actualReturnTime <= request.departureTime) {
      setError('The return time must be after the departure time.');
      return;
    }
    setError('');
    complete.mutate(
      {
        id: request.id,
        actualReturnTime,
        ...(visited.refs.length ? { stops: visited.refs } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Trip completed');
          onClose();
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Failed to complete trip')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={complete.isPending ? undefined : onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Complete Trip</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {[request.requester.name, request.destination, formatTravelDate(request.travelDate)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Planned {formatWindow(request.departureTime, request.returnTime)}. Once completed, the
          trip can&apos;t be changed.
        </p>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Actual return time</label>
          <input
            type="time"
            value={actualReturnTime}
            onChange={(e) => setActualReturnTime(e.target.value)}
            className={inputClass(error)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!error && verdict && request.returnTime && (
            <p
              className={cn(
                'text-xs font-medium',
                minutesLate !== null && minutesLate > 0 ? 'text-amber-600' : 'text-green-600',
              )}
            >
              {verdict}
              {minutesLate !== 0 ? ` (planned ${formatClock(request.returnTime)})` : ''}
            </p>
          )}
        </div>

        <MultiSelect
          label="Other places visited (optional)"
          placeholder={visited.isLoading ? 'Loading…' : 'Search clients and prospects'}
          options={visited.options}
          value={visited.selectedKeys}
          onChange={visited.onChange}
          onQueryChange={visited.setSearch}
          hideChips
        />

        {visited.selected.length > 0 && (
          <div className="flex flex-col gap-2">
            {visited.selected.map((place) => (
              <div
                key={`${place.kind}:${place.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {place.name}
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-tight text-gray-400">
                      {place.kind === 'CLIENT' ? 'Client' : 'Prospect'}
                    </span>
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {place.locationLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => visited.remove(place)}
                  className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onClose} disabled={complete.isPending}>
            Cancel
          </Button>
          <Button onClick={handleComplete} isLoading={complete.isPending} loadingText="Completing…">
            Complete Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
