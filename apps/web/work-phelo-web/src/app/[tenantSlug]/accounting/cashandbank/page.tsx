'use client';

import { CashAndBankStatsRow } from '@/components/molecules/accounting/CashAndBankStatsRow';
import { CashAccountsTable } from '@/components/organisms/accounting/tables/CashAccountsTable';
import { useCashAndBankStats } from '@/hooks';

export default function CashAndBankPage() {
  const { data: stats, isLoading: isLoadingStats } = useCashAndBankStats();
  const formatTotals = (totals: Record<string, number> | undefined) => {
    const values = Object.entries(totals ?? {});
    if (values.length === 0) return '—';
    return values
      .sort(([first], [second]) => first.localeCompare(second))
      .map(
        ([currency, value]) =>
          `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      )
      .join(' · ');
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Cash and Bank</h2>
      </div>

      <CashAndBankStatsRow
        isLoading={isLoadingStats}
        totalCashPosition={formatTotals(stats?.netCashPosition)}
        cashInflowMtd={formatTotals(stats?.inflowMtd)}
        cashOutflowMtd={formatTotals(stats?.outflowMtd)}
      />

      <CashAccountsTable />
    </div>
  );
}
