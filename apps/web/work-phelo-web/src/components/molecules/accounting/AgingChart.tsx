'use client';

import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useAgingReport } from '@/hooks/accounting/useAgingReports';
import { AGING_BUCKET_KEYS, AGING_BUCKET_LABELS } from '@/lib/accounting/aging';
import type { AccountingAgingPartyReport } from '@/types/accounting';
import { compactNumber, fullNumber } from './dashboardChartFormat';

const RECEIVABLE_COLOR = '#1baf7a';
const PAYABLE_COLOR = '#e34948';

const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// The axis is days past due, so the buckets stand in for date ranges.
const buckets = AGING_BUCKET_KEYS.map((key) => ({
  label: AGING_BUCKET_LABELS[key],
  detail: key === 'CURRENT' ? 'Not yet due' : `${AGING_BUCKET_LABELS[key]} days past due`,
  fromDate: '',
  toDate: '',
}));

interface AgingChartProps {
  /** Amounts in different currencies are never added, so one is shown; the base currency if empty. */
  currency: string;
  className?: string;
}

/** What customers owe and what is owed to suppliers, by how long it has been due. */
export function AgingChart({ currency, className }: AgingChartProps) {
  const { data: config } = useAccountingConfig();
  const asOfDate = today();
  const receivables = useAgingReport('receivables', asOfDate);
  const payables = useAgingReport('payables', asOfDate);

  const shown = currency || config?.baseCurrency || '';
  const values = (report: AccountingAgingPartyReport | undefined) => {
    const totals = report?.agingByCurrency.find((row) => row.currency === shown);
    return AGING_BUCKET_KEYS.map((key) => Number(totals?.[key] ?? 0));
  };
  const money = (value: number | null) =>
    value === null ? '' : `${shown} ${fullNumber(value)}`.trim();

  return (
    <PeriodBarChart
      title="Receivables & Payables Aging"
      subtitle={`Days past due, in ${shown || 'base currency'}`}
      buckets={buckets}
      series={[
        {
          label: 'Receivables',
          color: RECEIVABLE_COLOR,
          data: values(receivables.data),
          valueFormatter: money,
        },
        {
          label: 'Payables',
          color: PAYABLE_COLOR,
          data: values(payables.data),
          valueFormatter: money,
        },
      ]}
      isLoading={receivables.isLoading || payables.isLoading}
      isError={receivables.isError || payables.isError}
      errorText="Aging could not be loaded."
      emptyText="Nothing outstanding."
      axisFormatter={compactNumber}
      className={className}
    />
  );
}
