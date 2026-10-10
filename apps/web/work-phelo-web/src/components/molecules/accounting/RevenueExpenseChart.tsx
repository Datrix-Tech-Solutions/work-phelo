'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';
import { useIncomeSeries } from '@/hooks/accounting/useIncomeSeries';
import { periodSeriesBuckets } from '@/lib/periodSeries';

const REVENUE_COLOR = '#1baf7a';
const EXPENSE_COLOR = '#e34948';

const SUBTITLES: Record<Period, string> = {
  daily: 'This week, Monday to Sunday',
  weekly: 'Weeks of this month',
  monthly: 'This month and the previous 5',
  quarterly: 'Quarters of the current fiscal year',
  yearly: 'Current fiscal year and the previous 5',
};

const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

const full = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RevenueExpenseChartProps {
  period: Period;
  className?: string;
}

/** Revenue against expenses as paired bars, for the ranges that suit the period filter. */
export function RevenueExpenseChart({ period, className }: RevenueExpenseChartProps) {
  const { data: config } = useAccountingConfig();
  const { data: fiscalYears } = useFiscalYears();

  const buckets = useMemo(
    () =>
      periodSeriesBuckets(period, {
        fiscalYearStartMonth: config?.fiscalYearStartMonth,
        fiscalYears,
      }),
    [period, config?.fiscalYearStartMonth, fiscalYears],
  );
  const { data, isLoading, isError } = useIncomeSeries(buckets);

  const currency = config?.baseCurrency ?? '';
  const money = (value: number | null) =>
    value === null ? '' : `${currency} ${full(value)}`.trim();

  return (
    <PeriodBarChart
      title="Revenue vs Expenses"
      subtitle={SUBTITLES[period]}
      buckets={buckets}
      series={[
        {
          label: 'Revenue',
          color: REVENUE_COLOR,
          data: buckets.map((_, i) => Number(data?.[i]?.totalRevenue ?? 0)),
          valueFormatter: money,
        },
        {
          label: 'Expenses',
          color: EXPENSE_COLOR,
          data: buckets.map((_, i) => Number(data?.[i]?.totalExpenses ?? 0)),
          valueFormatter: money,
        },
      ]}
      isLoading={isLoading}
      isError={isError}
      errorText="Revenue and expenses could not be loaded."
      emptyText="No revenue or expenses in this range."
      axisFormatter={compact}
      className={className}
    />
  );
}
