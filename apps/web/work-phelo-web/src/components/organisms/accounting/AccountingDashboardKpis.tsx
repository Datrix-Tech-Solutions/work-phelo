'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeftRight, HandCoins, Receipt, Scale, TrendingUp, Wallet } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { DetailKpiCard } from '@/components/molecules/shared/DetailKpiCard';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import {
  AccountingKpiPanel,
  type AccountingKpi,
} from '@/components/organisms/accounting/AccountingKpiPanel';
import { useAccountingDashboardStats } from '@/hooks';
import { useAccountingAccess } from '@/hooks/accounting/useAccountingAccess';
import { formatDay } from '@/lib/dashboardPeriod';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const MODULE_COLOR = 'var(--module-accounting, #2a78d6)';

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
  const { fromDate, toDate, prevFromDate, prevToDate } = stats.ranges;

  // Open state is kept apart from the figure, so the panel keeps its content while it slides shut.
  const [kpi, setKpi] = useState<AccountingKpi>('cash');
  const [panelOpen, setPanelOpen] = useState(false);
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeePage } = useAccountingAccess();
  // A card is only clickable for someone who can open the page behind it.
  const opens = (page: string, next: AccountingKpi) =>
    canSeePage(page)
      ? () => {
          setKpi(next);
          setPanelOpen(true);
        }
      : undefined;
  // The statements open on the figures' own dates.
  const statement = (name: string, dates: Record<string, string>) =>
    canSeePage('financial-reports')
      ? `/${tenantSlug}/accounting/financial-reports/${name}?${new URLSearchParams(dates)}`
      : undefined;
  const profitAndLoss = statement('profit-and-loss', { fromDate, toDate });

  // What a trend badge was calculated against, so the percentage can be checked by hand.
  const previousRange = `${formatDay(prevFromDate)} – ${formatDay(prevToDate)}`;
  const comparedWith = (previous: number | undefined) =>
    `Previous (${previousRange}): ${money(base, previous)}`;
  const comparedAt = (previous: number | undefined) =>
    `Previous (at ${formatDay(prevToDate)}): ${money(base, previous)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Cash Position"
          onClick={opens('cashandbank', 'cash')}
          selected={panelOpen && kpi === 'cash'}
          value={currencyTotals(stats.cashPosition.totals, currency, base)}
          icon={Wallet}
          iconColor={MODULE_COLOR}
          isLoading={stats.cashPosition.isLoading}
        />
        <KpiCard
          label="Net Profit"
          href={profitAndLoss}
          value={money(base, stats.netProfit.value)}
          icon={TrendingUp}
          iconColor="#1baf7a"
          trend={stats.netProfit.trend}
          trendTooltip={comparedWith(stats.netProfit.previous)}
          periodLabel={periodLabel}
          isLoading={stats.netProfit.isLoading}
        />
        <KpiCard
          label="Receivables"
          onClick={opens('accountsreceivable', 'receivables')}
          selected={panelOpen && kpi === 'receivables'}
          value={currencyTotals(stats.receivables.totals, currency, base)}
          subPlacement="below"
          sub={[
            {
              label: `Raised this ${periodLabel}`,
              value: currencyTotals(stats.receivables.raised, currency, base),
            },
          ]}
          icon={Receipt}
          iconColor="#2a78d6"
          isLoading={stats.receivables.isLoading}
        />
        <KpiCard
          label="Payables"
          onClick={opens('expensesandpurchases', 'payables')}
          selected={panelOpen && kpi === 'payables'}
          value={currencyTotals(stats.payables.totals, currency, base)}
          subPlacement="below"
          sub={[
            {
              label: `Raised this ${periodLabel}`,
              value: currencyTotals(stats.payables.raised, currency, base),
            },
          ]}
          icon={HandCoins}
          iconColor="#eb6834"
          isLoading={stats.payables.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DetailKpiCard
          label="Total Revenue"
          href={profitAndLoss}
          value={money(base, stats.revenueAndExpenses.revenue)}
          icon={ArrowLeftRight}
          iconColor="#1baf7a"
          trend={stats.revenueAndExpenses.revenueTrend}
          trendTooltip={comparedWith(stats.revenueAndExpenses.previousRevenue)}
          periodLabel={periodLabel}
          details={[
            { label: 'Total expenses', value: money(base, stats.revenueAndExpenses.expenses) },
          ]}
          isLoading={stats.revenueAndExpenses.isLoading}
        />
        <DetailKpiCard
          label="Net Cash Change"
          href={statement('cash-flow-statement', { fromDate, toDate })}
          value={money(base, stats.netCash.change)}
          icon={Wallet}
          iconColor={MODULE_COLOR}
          trend={stats.netCash.trend}
          trendTooltip={comparedWith(stats.netCash.previous)}
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
          href={statement('balance-sheet', { asOfDate: toDate })}
          value={money(base, stats.netWorth.value)}
          icon={Scale}
          iconColor="#a855f7"
          trend={stats.netWorth.trend}
          trendTooltip={comparedAt(stats.netWorth.previous)}
          periodLabel={periodLabel}
          details={[
            { label: 'Total assets', value: money(base, stats.netWorth.assets) },
            { label: 'Total liabilities', value: money(base, stats.netWorth.liabilities) },
          ]}
          isLoading={stats.netWorth.isLoading}
        />
      </div>
      <AccountingKpiPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        kpi={kpi}
        currency={currency}
      />
    </div>
  );
}
