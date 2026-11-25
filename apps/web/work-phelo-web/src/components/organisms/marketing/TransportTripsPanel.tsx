'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useTransportTripList } from '@/hooks/marketing/useTransportDashboard';
import {
  formatTravelDate,
  formatWindow,
  HISTORY_REQUEST_STATUSES,
  REQUEST_STATUS_BADGES,
} from '@/lib/requestOptions';
import type { TransportRequestStatus, TransportTripList } from '@/types/marketing';

/** The Requests tab a request of this status is listed on. */
const tabFor = (status: TransportRequestStatus) =>
  HISTORY_REQUEST_STATUSES.includes(status) ? 'request-history' : 'all-requests';

const LISTS: Record<
  TransportTripList,
  { title: string; tab: 'all-requests' | 'request-history'; empty: string; live: boolean }
> = {
  REQUESTED: {
    title: 'Requests Raised',
    tab: 'all-requests',
    empty: 'No requests were raised in this range.',
    live: false,
  },
  ON_ROUTE: {
    title: 'On Route',
    tab: 'all-requests',
    empty: 'No trips are on route.',
    live: true,
  },
  OVERDUE: {
    title: 'Overdue Trips',
    tab: 'all-requests',
    empty: 'No trips are overdue.',
    live: true,
  },
  COMPLETED: {
    title: 'Completed',
    tab: 'request-history',
    empty: 'No trips were completed in this range.',
    live: false,
  },
  CLOSED: {
    title: 'Cancelled / Rejected',
    tab: 'request-history',
    empty: 'Nothing was cancelled or rejected in this range.',
    live: false,
  },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  list: TransportTripList;
  /** The dates listed; ignored by the live lists. */
  range: { fromDate: string; toDate: string };
  /** How those dates read under the title. */
  rangeLabel: string;
}

/** The trips behind one of the Transport dashboard's counts: a headline card or a chart bar. */
export function TransportTripsPanel({ isOpen, onClose, list, range, rangeLabel }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data = [], isLoading, isError } = useTransportTripList(list, range, isOpen);
  const { title, tab, empty, live } = LISTS[list];
  const tabHref = `/${tenantSlug}/marketing/requests/${tab}`;

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={live ? 'Right now' : rangeLabel}
      expandHref={tabHref}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-gray-400 text-center py-10">Trips could not be loaded.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((trip) => (
            <li key={trip.requestId}>
              <Link
                href={`/${tenantSlug}/marketing/requests/${tabFor(trip.status)}?requestId=${trip.requestId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100/70"
              >
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {trip.requesterName} · {trip.destination}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {[
                      formatTravelDate(trip.travelDate),
                      formatWindow(trip.departureTime, trip.returnTime),
                      trip.vehicleName,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {/* Only these lists mix statuses worth telling apart. */}
                {(list === 'CLOSED' || list === 'REQUESTED') && (
                  <Badge {...REQUEST_STATUS_BADGES[trip.status]} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardDrilldownPanel>
  );
}
