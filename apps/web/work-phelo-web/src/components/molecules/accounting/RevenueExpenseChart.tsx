'use client';

import { useMemo, useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { IncomeBarPanel, type IncomeBar } from '@/components/organisms/accounting/IncomeBarPanel';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';
import { useIncomeSeries } from '@/hooks/accounting/useIncomeSeries';
import { periodSeriesBuckets } from '@/lib/periodSeries';
import { compactNumber, fullNumber, SERIES_SUBTITLES } from './dashboardChartFormat';

const REVENUE_COLOR = '#1baf7a';
const EXPENSE_COLOR = '#e34948';

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
    value === null ? '' : `${currency} ${fullNumber(value)}`.trim();

  // Open state is kept apart from the bar, so the panel keeps its content while it slides shut.
  const [bar, setBar] = useState<IncomeBar | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <PeriodBarChart
        onBarClick={(bucketIndex, seriesIndex) => {
          // The series are listed below as revenue, then expenses.
          setBar({
            kind: seriesIndex === 0 ? 'revenue' : 'expenses',
            bucket: buckets[bucketIndex],
          });
          setPanelOpen(true);
        }}
        title="Revenue vs Expenses"
        subtitle={SERIES_SUBTITLES[period]}
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
        axisFormatter={compactNumber}
        className={className}
      />
      <IncomeBarPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        bar={bar}
        currency={currency}
      />
    </>
  );
}
