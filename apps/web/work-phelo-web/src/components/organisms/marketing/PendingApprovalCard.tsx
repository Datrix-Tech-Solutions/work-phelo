'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import {
  TransportListCard,
  type TransportListItem,
} from '@/components/molecules/marketing/TransportListCard';
import { useTransportDashboard } from '@/hooks/marketing/useTransportDashboard';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatTravelDate(iso.slice(0, 10));
}

interface Props {
  period: Period;
  year: number;
  className?: string;
}

/** Requests waiting for an approver, oldest first. A live list, so it ignores the period filter. */
export function PendingApprovalCard({ period, year, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useTransportDashboard(period, year);

  const items = useMemo<TransportListItem[]>(
    () =>
      (data?.pendingRequests ?? []).map((request) => ({
        id: request.requestId,
        icon: ClipboardList,
        color: '#eb6834',
        title: `${request.requesterName} · ${request.destination}`,
        detail: `Trip ${formatTravelDate(request.travelDate)}, ${formatClock(request.departureTime)}`,
        trailing: timeAgo(request.requestedAt),
      })),
    [data],
  );

  return (
    <TransportListCard
      title="Pending Approval"
      subtitle="Oldest requests first"
      count={data?.kpis.pending}
      items={items}
      isLoading={isLoading}
      isError={isError}
      emptyText="No requests are waiting."
      errorText="Pending requests could not be loaded."
      action={{ href: `/${tenantSlug}/marketing/requests/all-requests`, label: 'Review' }}
      className={className}
    />
  );
}
