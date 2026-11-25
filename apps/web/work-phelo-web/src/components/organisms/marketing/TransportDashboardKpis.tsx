'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Route, XCircle } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { TransportTripsPanel } from '@/components/organisms/marketing/TransportTripsPanel';
import { useTransportDashboard } from '@/hooks/marketing/useTransportDashboard';
import { dashboardRanges, formatDay, trendBetween } from '@/lib/dashboardPeriod';
import type { TransportTripList } from '@/types/marketing';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

interface Props {
  period: Period;
  year: number;
}

/** The headline counts: what is on the road or late, and how the period compares. */
export function TransportDashboardKpis({ period, year }: Props) {
  const { data, isLoading } = useTransportDashboard(period, year);
  const periodLabel = PERIOD_LABELS[period];
  const { fromDate, toDate, prevFromDate, prevToDate } = dashboardRanges(period, year);
  const previous = `Previous (${formatDay(prevFromDate)} – ${formatDay(prevToDate)}): `;
  const kpis = data?.kpis;
  const value = (n: number | undefined) => (n === undefined ? '—' : n);
  // Open state is kept apart from the list, so the panel keeps its content while it slides shut.
  const [list, setList] = useState<TransportTripList>('ON_ROUTE');
  const [panelOpen, setPanelOpen] = useState(false);
  const open = (next: TransportTripList) => () => {
    setList(next);
    setPanelOpen(true);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="On Route"
        onClick={open('ON_ROUTE')}
        value={value(kpis?.onRoute)}
        icon={Route}
        iconColor="#2a78d6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Overdue Trips"
        onClick={open('OVERDUE')}
        value={value(kpis?.overdue)}
        icon={AlertTriangle}
        iconColor="#e34948"
        isLoading={isLoading}
      />
      <KpiCard
        label="Completed"
        onClick={open('COMPLETED')}
        value={value(kpis?.completed.current)}
        icon={CheckCircle2}
        iconColor="#1baf7a"
        trend={kpis ? trendBetween(kpis.completed.current, kpis.completed.previous) : undefined}
        trendTooltip={`${previous}${kpis?.completed.previous ?? '—'}`}
        periodLabel={periodLabel}
        isLoading={isLoading}
      />
      <KpiCard
        label="Cancelled / Rejected"
        onClick={open('CLOSED')}
        value={value(kpis?.closed.current)}
        icon={XCircle}
        iconColor="#6b7280"
        sub={kpis ? [{ label: 'Previous', value: kpis.closed.previous }] : undefined}
        isLoading={isLoading}
      />
      <TransportTripsPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        list={list}
        range={{ fromDate, toDate }}
        rangeLabel={`${formatDay(fromDate)} – ${formatDay(toDate)}`}
      />
    </div>
  );
}
