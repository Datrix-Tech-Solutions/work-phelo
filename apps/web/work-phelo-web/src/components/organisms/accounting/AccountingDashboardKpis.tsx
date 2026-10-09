'use client';

import { ArrowLeftRight, HandCoins, Receipt, Scale, TrendingUp, Wallet } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { DetailKpiCard } from '@/components/molecules/shared/DetailKpiCard';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { useAccountingDashboardStats } from '@/hooks';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const MODULE_COLOR = 'var(--module-accounting, #2a78d6)';
const TREND_TOOLTIP = 'Compared with the same number of days in the previous period';

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A base-currency figure, or a dash while it is unavailable. */
const money = (currency: string, value: number | undefined) =>
  value === undefined ? '—' : `${currency} ${fmt(value)}`.trim();

/**
 * Per-currency balances as "GHS 1,000.00 · USD 20.00", narrowed to one currency when filtered.
 * `undefined` totals mean the data did not load (shown as a dash); an empty set means nothing
 * is held or owed, shown as zero in the base currency.
 */
function currencyTotals(
  totals: Record<string, number> | undefined,
  currency: string,
  baseCurrency: string,
) {
  if (!totals) return '—';
  const entries = Object.entries(totals)
    .filter(([code]) => !currency || code === currency)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return `${currency || baseCurrency} ${fmt(0)}`.trim();
  return entries.map(([code, value]) => `${code} ${fmt(value)}`).join(' · ');
}

interface AccountingDashboardKpisProps {
  period: Period;
  year: number;
  /** Currency filter: narrows cash, receivables and payables. Statement figures stay in base currency. */
  currency: string;
}

export function AccountingDashboardKpis({ period, year, currency }: AccountingDashboardKpisProps) {
  const stats = useAccountingDashboardStats(period, year);
  const base = stats.baseCurrency;
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Cash Position"
          value={currencyTotals(stats.cashPosition.totals, currency, base)}
          icon={Wallet}
          iconColor={MODULE_COLOR}
          isLoading={stats.cashPosition.isLoading}
        />
        <KpiCard
          label="Net Profit"
          value={money(base, stats.netProfit.value)}
          icon={TrendingUp}
          iconColor="#1baf7a"
          trend={stats.netProfit.trend}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          isLoading={stats.netProfit.isLoading}
        />
        <KpiCard
          label="Receivables"
          value={currencyTotals(stats.receivables.totals, currency, base)}
          icon={Receipt}
          iconColor="#2a78d6"
          isLoading={stats.receivables.isLoading}
        />
        <KpiCard
          label="Payables"
          value={currencyTotals(stats.payables.totals, currency, base)}
          icon={HandCoins}
          iconColor="#eb6834"
          isLoading={stats.payables.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DetailKpiCard
          label="Total Revenue"
          value={money(base, stats.revenueAndExpenses.revenue)}
          icon={ArrowLeftRight}
          iconColor="#1baf7a"
          trend={stats.revenueAndExpenses.revenueTrend}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          details={[
            { label: 'Total expenses', value: money(base, stats.revenueAndExpenses.expenses) },
          ]}
          isLoading={stats.revenueAndExpenses.isLoading}
        />
        <DetailKpiCard
          label="Net Cash Change"
          value={money(base, stats.netCash.change)}
          icon={Wallet}
          iconColor={MODULE_COLOR}
          trend={stats.netCash.trend}
          trendTooltip={TREND_TOOLTIP}
          periodLabel={periodLabel}
          details={[
            { label: 'Operating', value: money(base, stats.netCash.operating) },
            { label: 'Investing', value: money(base, stats.netCash.investing) },
            { label: 'Financing', value: money(base, stats.netCash.financing) },
          ]}
          isLoading={stats.netCash.isLoading}
        />
        <DetailKpiCard
          label="Net Worth"
          value={money(base, stats.netWorth.value)}
          icon={Scale}
          iconColor="#a855f7"
          trend={stats.netWorth.trend}
          trendTooltip="Compared with the end of the previous period"
          periodLabel={periodLabel}
          details={[
            { label: 'Total assets', value: money(base, stats.netWorth.assets) },
            { label: 'Total liabilities', value: money(base, stats.netWorth.liabilities) },
          ]}
          isLoading={stats.netWorth.isLoading}
        />
      </div>
    </div>
  );
}
