'use client';

import { useState } from 'react';
import { Handshake, Percent, UserPlus, Wallet } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CrmKpiPanel, type CrmKpi } from '@/components/organisms/marketing/CrmKpiPanel';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';
import { dashboardRanges, formatDay, trendBetween } from '@/lib/dashboardPeriod';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const MODULE_COLOR = 'var(--module-marketing, #0466f8)';

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A 2dp money string with the currency, or a dash when the figure is unavailable. */
const money = (currency: string | null | undefined, value: string | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return `${currency ?? ''} ${fmt(Number(value))}`.trim();
};

const trendOf = (current: string | null | undefined, previous: string | null | undefined) =>
  trendBetween(
    current == null ? undefined : Number(current),
    previous == null ? undefined : Number(previous),
  );

const rate = (converted: number, created: number) =>
  created > 0 ? (converted / created) * 100 : undefined;

interface MarketingDashboardKpisProps {
  period: Period;
  year: number;
  userId?: string;
}

export function MarketingDashboardKpis({ period, year, userId }: MarketingDashboardKpisProps) {
  const { data, isLoading } = useMarketingDashboard(period, year, userId);
  const periodLabel = PERIOD_LABELS[period];
  const currency = data?.currency;
  // Open state is kept apart from the figure, so the panel keeps its content while it slides shut.
  const [kpi, setKpi] = useState<CrmKpi>('sales');
  const [panelOpen, setPanelOpen] = useState(false);
  const open = (next: CrmKpi) => () => {
    setKpi(next);
    setPanelOpen(true);
  };

  const conversionRate = data
    ? rate(data.conversion.converted, data.conversion.created)
    : undefined;
  const previousRate = data
    ? rate(data.conversion.previousConverted, data.conversion.previousCreated)
    : undefined;
  // No prospects last period means no previous rate: still a (neutral) badge, so it can be inspected.
  const conversionTrend =
    data && conversionRate !== undefined
      ? trendBetween(conversionRate, previousRate ?? conversionRate)
      : undefined;
  const prospectsTrend = data
    ? trendBetween(data.newProspects.current, data.newProspects.previous)
    : undefined;

  // What each badge was calculated against, so its percentage can be checked by hand.
  const { prevFromDate, prevToDate } = dashboardRanges(period, year);
  const previousFrom = `Previous (${formatDay(prevFromDate)} – ${formatDay(prevToDate)}): `;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Overall Sales"
          onClick={open('sales')}
          value={money(currency, data?.sales.won)}
          icon={Handshake}
          iconColor={MODULE_COLOR}
          sub={
            data ? [{ label: 'Expected', value: money(currency, data.sales.expected) }] : undefined
          }
          trend={trendOf(data?.sales.won, data?.sales.previousWon)}
          trendTooltip={`${previousFrom}${money(currency, data?.sales.previousWon)}`}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="Achieved Revenue"
          onClick={open('revenue')}
          value={money(currency, data?.achievedRevenue.current)}
          icon={Wallet}
          iconColor="#1baf7a"
          trend={trendOf(data?.achievedRevenue.current, data?.achievedRevenue.previous)}
          trendTooltip={`${previousFrom}${money(currency, data?.achievedRevenue.previous)}`}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="Conversion Rate"
          onClick={open('conversion')}
          value={conversionRate === undefined ? '—' : `${conversionRate.toFixed(1)}%`}
          icon={Percent}
          iconColor="#2a78d6"
          sub={
            data
              ? [
                  {
                    label: 'Converted',
                    value: `${data.conversion.converted} of ${data.conversion.created}`,
                  },
                ]
              : undefined
          }
          trend={conversionTrend}
          trendTooltip={`${previousFrom}${
            previousRate === undefined
              ? 'no prospects'
              : `${previousRate.toFixed(1)}% (${data?.conversion.previousConverted} of ${data?.conversion.previousCreated})`
          }`}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="New Prospects"
          onClick={open('prospects')}
          value={data ? data.newProspects.current : '—'}
          icon={UserPlus}
          iconColor="#eb6834"
          trend={prospectsTrend}
          trendTooltip={`${previousFrom}${data?.newProspects.previous ?? '—'}`}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
      </div>
      <CrmKpiPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        kpi={kpi}
        currency={currency}
        period={period}
        year={year}
        userId={userId}
      />
    </div>
  );
}
