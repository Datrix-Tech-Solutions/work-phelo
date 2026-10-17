'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useTransportDashboard } from '@/hooks/marketing/useTransportDashboard';
import type { Period } from '@/components/atoms/PeriodToggle';
import { formatTravelDate, formatClock } from '@/lib/requestOptions';
import { cardClass, cn } from '@/lib/utils';

interface Props {
  period: Period;
  year: number;
  className?: string;
}

function Section({
  title,
  count,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </h4>
        <Link
          href={href}
          className="text-xs font-medium text-(--module-btn-bg,#0466f8) hover:underline"
        >
          {hrefLabel}
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-gray-100">{children}</ul>
    </div>
  );
}

function Row({ title, detail, tone }: { title: string; detail: string; tone?: 'red' | 'amber' }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="truncate font-medium text-gray-800">{title}</span>
      <span
        className={cn(
          'shrink-0 text-xs',
          tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-gray-500',
        )}
      >
        {detail}
      </span>
    </li>
  );
}

/** What needs a person today: trips that are late, vehicles that can't go out. */
export function TransportAttentionCard({ period, year, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading } = useTransportDashboard(period, year);
  const base = `/${tenantSlug}/marketing`;
  const attention = data?.attention;

  const empty =
    !!attention &&
    attention.overdueTrips.length === 0 &&
    attention.vehicleDocuments.length === 0 &&
    attention.maintenance.length === 0;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Needs Attention</h3>
        <span className="text-xs text-gray-400">
          Late trips and vehicles that can&apos;t go out
        </span>
      </div>

      {isLoading && <Skeleton className="h-24 w-full" />}
      {empty && (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          Nothing needs attention.
        </div>
      )}

      {attention && !empty && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {attention.overdueTrips.length > 0 && (
            <Section
              title="Overdue trips"
              count={data?.kpis.overdue}
              href={`${base}/requests/all-requests`}
              hrefLabel="View"
            >
              {attention.overdueTrips.map((t) => (
                <Row
                  key={t.requestId}
                  title={`${t.vehicleName ?? 'Trip'} · ${t.destination}`}
                  detail={
                    t.returnTime
                      ? `Due back ${formatTravelDate(t.travelDate)}, ${formatClock(t.returnTime)}`
                      : formatTravelDate(t.travelDate)
                  }
                  tone="red"
                />
              ))}
            </Section>
          )}

          {attention.vehicleDocuments.length > 0 && (
            <Section title="Vehicle documents" href={`${base}/fleet-management`} hrefLabel="Fleet">
              {attention.vehicleDocuments.flatMap((v) =>
                v.alerts.map((a) => (
                  <Row
                    key={`${v.assetId}-${a.label}`}
                    title={`${v.name} · ${a.label}`}
                    detail={
                      a.state === 'EXPIRED'
                        ? `Expired ${formatTravelDate(a.expiresOn)}`
                        : a.daysLeft === 0
                          ? 'Expires today'
                          : `Expires in ${a.daysLeft} ${a.daysLeft === 1 ? 'day' : 'days'}`
                    }
                    tone={a.state === 'EXPIRED' ? 'red' : 'amber'}
                  />
                )),
              )}
            </Section>
          )}

          {attention.maintenance.length > 0 && (
            <Section title="In maintenance" href={`${base}/fleet-management`} hrefLabel="Fleet">
              {attention.maintenance.map((v) => (
                <Row key={v.assetId} title={v.name} detail={v.assetNumber} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
