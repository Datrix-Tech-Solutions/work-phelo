'use client';

import { useParams } from 'next/navigation';
import { DrilldownList } from '@/components/molecules/shared/DrilldownList';
import { fullNumber } from '@/components/molecules/accounting/dashboardChartFormat';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useAccountingAccess } from '@/hooks/accounting/useAccountingAccess';
import { useIncomeStatementReport } from '@/hooks/accounting/useFinancialReports';
import type { SeriesBucket } from '@/lib/periodSeries';

export interface IncomeBar {
  kind: 'revenue' | 'expenses';
  bucket: SeriesBucket;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bar: IncomeBar | null;
  /** The base currency, which the statement is in. */
  currency: string;
}

/** The accounts that make up the bar picked on the Revenue vs Expenses chart. */
export function IncomeBarPanel({ isOpen, onClose, bar, currency }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeePage } = useAccountingAccess();
  const fromDate = bar?.bucket.fromDate;
  const toDate = bar?.bucket.toDate;
  const { data, isLoading, isError } = useIncomeStatementReport(
    { fromDate, toDate },
    isOpen && bar !== null,
  );
  const isExpenses = bar?.kind === 'expenses';
  const accounts = (isExpenses ? data?.expenseAccounts : data?.revenueAccounts) ?? [];

  const rows = accounts
    .filter((row) => Number(row.amount) !== 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .map((row) => ({
      id: row.account.id,
      title: row.account.name,
      detail: `${row.account.code} · ${row.account.classification.name}`,
      trailing: `${currency} ${fullNumber(Number(row.amount))}`.trim(),
    }));

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={isExpenses ? 'Expenses' : 'Revenue'}
      description={bar ? `By account, ${bar.bucket.detail}` : undefined}
      expandHref={
        bar && canSeePage('financial-reports')
          ? `/${tenantSlug}/accounting/financial-reports/profit-and-loss?${new URLSearchParams({
              fromDate: bar.bucket.fromDate,
              toDate: bar.bucket.toDate,
            })}`
          : undefined
      }
    >
      <DrilldownList
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        emptyText={`No ${isExpenses ? 'expenses' : 'revenue'} in this range.`}
      />
    </DashboardDrilldownPanel>
  );
}
