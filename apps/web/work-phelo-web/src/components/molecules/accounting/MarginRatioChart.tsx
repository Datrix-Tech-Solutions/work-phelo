'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodLineChart } from '@/components/molecules/shared/PeriodLineChart';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';
import { useIncomeSeries } from '@/hooks/accounting/useIncomeSeries';
import { periodSeriesBuckets } from '@/lib/periodSeries';
import { SERIES_SUBTITLES } from './dashboardChartFormat';

const MARGIN_COLOR = '#1baf7a';
const EXPENSE_RATIO_COLOR = '#e34948';

const percent = (value: number | null) => (value === null ? 'No revenue' : `${value.toFixed(1)}%`);

interface MarginRatioChartProps {
  period: Period;
  className?: string;
}

/**
 * Profit margin (profit ÷ revenue) and expense ratio (expenses ÷ revenue) for each range.
 * A range with no revenue has neither, so it is left as a gap rather than drawn as zero.
 */
export function MarginRatioChart({ period, className }: MarginRatioChartProps) {
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

  const ratios = buckets.map((_, i) => {
    const revenue = Number(data?.[i]?.totalRevenue ?? 0);
    const expenses = Number(data?.[i]?.totalExpenses ?? 0);
    if (revenue <= 0) return { margin: null, expense: null };
    return { margin: ((revenue - expenses) / revenue) * 100, expense: (expenses / revenue) * 100 };
  });

  return (
    <PeriodLineChart
      title="Profit Margin & Expense Ratio"
      subtitle={SERIES_SUBTITLES[period]}
      buckets={buckets}
      series={[
        {
          label: 'Profit margin',
          color: MARGIN_COLOR,
          data: ratios.map((r) => r.margin),
          valueFormatter: percent,
        },
        {
          label: 'Expense ratio',
          color: EXPENSE_RATIO_COLOR,
          data: ratios.map((r) => r.expense),
          valueFormatter: percent,
        },
      ]}
      isLoading={isLoading}
      isError={isError}
      errorText="Margins could not be loaded."
      emptyText="No revenue in this range to measure against."
      axisFormatter={(value) => `${value}%`}
      className={className}
    />
  );
}
