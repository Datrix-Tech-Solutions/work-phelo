'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';
import { cn } from '@/lib/utils';
import type { TripState } from '@/types/marketing';

export interface TripListItem {
  requestId: string;
  state: TripState;
  travelDate: string;
  departureTime: string;
  returnTime: string;
  destination: string;
  requesterName: string;
  /** The other party on the trip, e.g. "Driver: Ama Mensah" or "Vehicle: Toyota Hilux". */
  with: string | null;
}

const STATE_STYLES: Record<TripState, { label: string; bg: string; text: string }> = {
  ON_ROUTE: { label: 'On route', bg: 'bg-blue-50', text: 'text-blue-700' },
  BOOKED: { label: 'Booked', bg: 'bg-violet-50', text: 'text-violet-700' },
};

interface Props {
  /** The panel is open while this is set. */
  trips: TripListItem[] | null;
  /** Total booked trips, when more than `trips` are listed. */
  totalCount?: number;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function TripsPanel({ trips, totalCount, title, subtitle, onClose }: Props) {
  return (
    <SidePanel isOpen={trips !== null} onClose={onClose} title={title} description={subtitle}>
      {trips && trips.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">No booked trips.</p>
      )}

      {trips && trips.length > 0 && (
        <div className="flex flex-col gap-2">
          {trips.map((trip) => {
            const style = STATE_STYLES[trip.state];
            return (
              <div
                key={trip.requestId}
                className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {trip.destination}
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0',
                      style.bg,
                      style.text,
                    )}
                  >
                    {style.label}
                  </span>
                </div>
                <span className="text-xs text-gray-700">
                  {formatTravelDate(trip.travelDate)} · {formatClock(trip.departureTime)} –{' '}
                  {formatClock(trip.returnTime)}
                </span>
                <span className="text-xs text-gray-500">Requested by {trip.requesterName}</span>
                {trip.with && <span className="text-xs text-gray-500">{trip.with}</span>}
              </div>
            );
          })}
          {totalCount !== undefined && totalCount > trips.length && (
            <p className="text-xs text-gray-400 text-center pt-1">
              Showing the next {trips.length} of {totalCount} trips.
            </p>
          )}
        </div>
      )}
    </SidePanel>
  );
}
