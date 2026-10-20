'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useCashFlowSeries } from '@/hooks/accounting/useCashFlowSeries';
import { useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';
import { periodSeriesBuckets } from '@/lib/periodSeries';
import { compactNumber, fullNumber, SERIES_SUBTITLES } from './dashboardChartFormat';

const OPERATING_COLOR = '#2a78d6';
const INVESTING_COLOR = '#e8a31d';
const FINANCING_COLOR = '#8b5cf6';

interface CashFlowTrendChartProps {
  period: Period;
  className?: string;
}

/** Operating, investing and financing cash flow for each range of the period filter. */
export function CashFlowTrendChart({ period, className }: CashFlowTrendChartProps) {
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
  const { data, isLoading, isError } = useCashFlowSeries(buckets);

  const currency = config?.baseCurrency ?? '';
  const money = (value: number | null) =>
    value === null ? '' : `${currency} ${fullNumber(value)}`.trim();
  const values = (pick: 'operating' | 'investing' | 'financing') =>
    buckets.map((_, i) => Number(data?.[i]?.[pick] ?? 0));

  return (
    <PeriodBarChart
      title="Cash Flow Trend"
      subtitle={SERIES_SUBTITLES[period]}
      buckets={buckets}
      series={[
        {
          label: 'Operating',
          color: OPERATING_COLOR,
          data: values('operating'),
          valueFormatter: money,
        },
        {
          label: 'Investing',
          color: INVESTING_COLOR,
          data: values('investing'),
          valueFormatter: money,
        },
        {
          label: 'Financing',
          color: FINANCING_COLOR,
          data: values('financing'),
          valueFormatter: money,
        },
      ]}
      isLoading={isLoading}
      isError={isError}
      errorText="Cash flow could not be loaded."
      emptyText="No cash movement in this range."
      axisFormatter={compactNumber}
      className={className}
    />
  );
}
