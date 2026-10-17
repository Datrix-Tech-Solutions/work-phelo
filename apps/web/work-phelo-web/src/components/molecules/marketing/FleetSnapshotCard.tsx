'use client';

import { Skeleton } from '@/components/atoms/Skeleton';
import { useTransportDashboard } from '@/hooks/marketing/useTransportDashboard';
import type { Period } from '@/components/atoms/PeriodToggle';
import { FLEET_STATUS_STYLES } from '@/lib/fleetOptions';
import { cardClass, cn } from '@/lib/utils';
import type { FleetStatus } from '@/types/marketing';

interface Props {
  period: Period;
  year: number;
  className?: string;
}

const ROWS: {
  status: FleetStatus;
  key: 'available' | 'booked' | 'onRoute' | 'documentsExpired' | 'maintenance';
  bar: string;
}[] = [
  { status: 'AVAILABLE', key: 'available', bar: 'bg-emerald-500' },
  { status: 'BOOKED', key: 'booked', bar: 'bg-violet-500' },
  { status: 'ON_ROUTE', key: 'onRoute', bar: 'bg-blue-500' },
  { status: 'DOCUMENTS_EXPIRED', key: 'documentsExpired', bar: 'bg-red-500' },
  { status: 'MAINTENANCE', key: 'maintenance', bar: 'bg-yellow-500' },
];

/** Vehicles in service, by status, with how many are free right now. */
export function FleetSnapshotCard({ period, year, className }: Props) {
  const { data, isLoading } = useTransportDashboard(period, year);
  const fleet = data?.fleet;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Fleet Status</h3>
        <span className="text-xs text-gray-400">
          {fleet ? `${fleet.available} of ${fleet.total} vehicles free` : 'Vehicles in service'}
        </span>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && !fleet && (
        <p className="py-6 text-center text-sm text-gray-400">The fleet could not be loaded.</p>
      )}
      {fleet && fleet.total === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">No vehicles yet.</p>
      )}
      {fleet && fleet.total > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-y-auto">
          {ROWS.map(({ status, key, bar }) => (
            <li key={status} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-gray-600">
                {FLEET_STATUS_STYLES[status].label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={cn('block h-full rounded-full', bar)}
                  style={{ width: `${(fleet[key] / fleet.total) * 100}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-semibold text-gray-800">
                {fleet[key]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
