'use client';

import { Handshake, Percent, Target, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { DetailKpiCard } from '@/components/molecules/shared/DetailKpiCard';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';
import { percentChange } from '@/lib/dashboardPeriod';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const MODULE_COLOR = 'var(--module-marketing, #0466f8)';
const TREND_TOOLTIP = 'Compared with the same number of days in the previous period';

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A 2dp money string with the currency, or a dash when the figure is unavailable. */
const money = (currency: string | null | undefined, value: string | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return `${currency ?? ''} ${fmt(Number(value))}`.trim();
};

const trendOf = (current: string | null | undefined, previous: string | null | undefined) =>
  current == null || previous == null
    ? undefined
    : percentChange(Number(current), Number(previous));

const rate = (converted: number, created: number) =>
  created > 0 ? (converted / created) * 100 : undefined;

interface MarketingDashboardKpisProps {
  period: Period;
  year: number;
}

export function MarketingDashboardKpis({ period, year }: MarketingDashboardKpisProps) {
  const { data, isLoading } = useMarketingDashboard(period, year);
  const periodLabel = PERIOD_LABELS[period];
  const currency = data?.currency;

  const conversionRate = data
    ? rate(data.conversion.converted, data.conversion.created)
    : undefined;
  const previousRate = data
    ? rate(data.conversion.previousConverted, data.conversion.previousCreated)
    : undefined;
  const conversionTrend =
    conversionRate !== undefined && previousRate !== undefined
      ? percentChange(conversionRate, previousRate)
      : undefined;
  const prospectsTrend = data
    ? percentChange(data.newProspects.current, data.newProspects.previous)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Overall Sales"
          value={money(currency, data?.sales.won)}
          icon={Handshake}
          iconColor={MODULE_COLOR}
          sub={
            data ? [{ label: 'Expected', value: money(currency, data.sales.expected) }] : undefined
          }
          trend={trendOf(data?.sales.won, data?.sales.previousWon)}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="Achieved Revenue"
          value={money(currency, data?.achievedRevenue.current)}
          icon={Wallet}
          iconColor="#1baf7a"
          trend={trendOf(data?.achievedRevenue.current, data?.achievedRevenue.previous)}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="Conversion Rate"
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
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
        <KpiCard
          label="New Prospects"
          value={data ? data.newProspects.current : '—'}
          icon={UserPlus}
          iconColor="#eb6834"
          trend={prospectsTrend}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DetailKpiCard
          label="Pipeline Forecast"
          value={money(currency, data?.pipeline.weighted)}
          icon={TrendingUp}
          iconColor={MODULE_COLOR}
          details={[
            ...(data?.pipeline.stages.map((stage) => ({
              label: `${stage.name} (${stage.prospects})`,
              value: money(currency, stage.expected),
            })) ?? []),
            { label: 'Total expected', value: money(currency, data?.pipeline.expected) },
          ]}
          isLoading={isLoading}
        />
        <DetailKpiCard
          label="Target Progress"
          value={data?.targets.percent == null ? '—' : `${data.targets.percent}%`}
          icon={Target}
          iconColor="#a855f7"
          details={[
            { label: 'Target', value: money(currency, data?.targets.target) },
            { label: 'Achieved', value: money(currency, data?.targets.achieved) },
            { label: 'Remaining', value: money(currency, data?.targets.remaining) },
          ]}
          isLoading={isLoading}
        />
        <DetailKpiCard
          label="Clients"
          value={data ? String(data.clients.total) : '—'}
          icon={Users}
          iconColor="#2a78d6"
          details={[
            { label: `New this ${periodLabel}`, value: String(data?.clients.new ?? '—') },
            { label: 'Billable', value: String(data?.clients.billable ?? '—') },
            { label: 'Non-billable', value: String(data?.clients.nonBillable ?? '—') },
          ]}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
