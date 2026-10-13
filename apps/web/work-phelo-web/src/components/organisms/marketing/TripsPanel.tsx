'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { describeReturn, formatClock, formatTravelDate, formatWindow } from '@/lib/requestOptions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import type { CompletedTrip, TripState } from '@/types/marketing';

export interface TripListItem {
  requestId: string;
  state: TripState;
  /** Return time has passed but the trip has not been completed. */
  overdue: boolean;
  travelDate: string;
  departureTime: string;
  returnTime: string | null;
  destination: string;
  requesterName: string;
  /** The other party on the trip, e.g. "Driver: Ama Mensah" or "Vehicle: Toyota Hilux". */
  with: string | null;
}

const STATE_STYLES: Record<TripState, { label: string; bg: string; text: string }> = {
  ON_ROUTE: { label: 'On route', bg: 'bg-blue-50', text: 'text-blue-700' },
  BOOKED: { label: 'Booked', bg: 'bg-violet-50', text: 'text-violet-700' },
};

/** Trips already completed, loaded a page at a time. */
export interface TripHistory {
  items: CompletedTrip[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** The other party on a past trip, e.g. "Driver: Ama Mensah" or "Vehicle: Toyota Hilux". */
  describeWith: (trip: CompletedTrip) => string | null;
}

interface Props {
  /** The panel is open while this is set. */
  trips: TripListItem[] | null;
  /** Total booked trips, when more than `trips` are listed. */
  totalCount?: number;
  /** Past trips, shown under the current and booked ones. */
  history?: TripHistory;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">{children}</p>
  );
}

function HistoryRow({ trip, withText }: { trip: CompletedTrip; withText: string | null }) {
  const verdict = describeReturn(trip.minutesLate);
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900 truncate">
          {trip.destination || 'No destination'}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 bg-gray-100 text-gray-600">
          Completed
        </span>
      </div>
      <span className="text-xs text-gray-700">
        {formatTravelDate(trip.travelDate)} · {formatWindow(trip.departureTime, trip.returnTime)}
      </span>
      <span
        className={cn(
          'text-xs font-medium',
          trip.minutesLate === null
            ? 'text-gray-400'
            : trip.minutesLate > 0
              ? 'text-amber-600'
              : 'text-green-600',
        )}
      >
        {trip.actualReturnTime
          ? `Returned ${formatClock(trip.actualReturnTime)}${verdict ? ` · ${verdict}` : ''}`
          : 'Return time not recorded'}
      </span>
      <span className="text-xs text-gray-500">Requested by {trip.requesterName}</span>
      {withText && <span className="text-xs text-gray-500">{withText}</span>}
    </div>
  );
}

export function TripsPanel({ trips, totalCount, history, title, subtitle, onClose }: Props) {
  return (
    <SidePanel isOpen={trips !== null} onClose={onClose} title={title} description={subtitle}>
      {trips && (
        <div className="flex flex-col gap-2">
          <SectionTitle>Current &amp; booked</SectionTitle>
          {trips.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No booked trips.</p>
          )}
          {trips.map((trip) => {
            const style = trip.overdue
              ? { label: 'Overdue', bg: 'bg-amber-50', text: 'text-amber-700' }
              : STATE_STYLES[trip.state];
            return (
              <div
                key={trip.requestId}
                className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {trip.destination || 'No destination'}
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
                  {formatTravelDate(trip.travelDate)} ·{' '}
                  {formatWindow(trip.departureTime, trip.returnTime)}
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

          {history && (
            <>
              <div className="mt-3">
                <SectionTitle>History{history.total > 0 ? ` (${history.total})` : ''}</SectionTitle>
              </div>
              {history.isLoading && (
                <p className="text-sm text-gray-400 text-center py-4">Loading history…</p>
              )}
              {!history.isLoading && history.items.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No completed trips yet.</p>
              )}
              {history.items.map((trip) => (
                <HistoryRow
                  key={trip.requestId}
                  trip={trip}
                  withText={history.describeWith(trip)}
                />
              ))}
              {history.hasMore && (
                <Button
                  variant="outline"
                  onClick={history.onLoadMore}
                  isLoading={history.isLoadingMore}
                  loadingText="Loading…"
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
