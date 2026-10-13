'use client';

import { CheckCircle2, Play } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { formatClock, formatTravelDate, formatWindow } from '@/lib/requestOptions';
import type { TransportRequest } from '@/types/marketing';

/** Local today and now, as YYYY-MM-DD and HH:mm. */
function localNow() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

interface Props {
  /** The trip that was just sent and approved; the pop-up is shown while this is set. */
  request: TransportRequest | null;
  onClose: () => void;
  /** Hands the trip to the start form. */
  onStart: (request: TransportRequest) => void;
}

export function ApprovedTripModal({ request, onClose, onStart }: Props) {
  if (!request) return null;

  // The backend allows starting from the travel day; here it is offered once the planned
  // departure has come, which is when a trip is normally started.
  const now = localNow();
  const departureReached =
    request.travelDate < now.date ||
    (request.travelDate === now.date && request.departureTime <= now.time);
  const canStart = request.startable && departureReached;

  const driver = request.allocation?.driver;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Request sent and approved</p>
            <p className="text-xs text-gray-500 mt-0.5">The vehicle and driver are allocated.</p>
          </div>
        </div>

        <dl className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm flex flex-col gap-2">
          {request.destination && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Destination</dt>
              <dd className="font-medium text-gray-900 text-right">{request.destination}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">When</dt>
            <dd className="font-medium text-gray-900 text-right">
              {formatTravelDate(request.travelDate)}{' '}
              {formatWindow(request.departureTime, request.returnTime)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Vehicle</dt>
            <dd className="font-medium text-gray-900 text-right">
              {request.allocation?.vehicle.name ?? '—'}
              {request.allocation?.vehicle.assetNumber
                ? ` · ${request.allocation.vehicle.assetNumber}`
                : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Driver</dt>
            <dd className="font-medium text-gray-900 text-right">
              {driver?.selfDriven ? 'Self-driven' : (driver?.name ?? '—')}
            </dd>
          </div>
        </dl>

        {!canStart && (
          <p className="text-xs text-gray-500">
            The trip can be started from {formatClock(request.departureTime)} on{' '}
            {formatTravelDate(request.travelDate)}.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          {canStart && (
            <Button onClick={() => onStart(request)}>
              <Play className="w-4 h-4" />
              Start Trip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
