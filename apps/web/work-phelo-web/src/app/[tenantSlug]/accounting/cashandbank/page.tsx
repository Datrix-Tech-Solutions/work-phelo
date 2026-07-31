'use client';

import { CashAndBankStatsRow } from '@/components/molecules/accounting/CashAndBankStatsRow';
import { CashAndBankTable } from '@/components/organisms/accounting/tables/CashAndBankTable';

// TODO: replace with useCashAndBankStats() hook once API is ready
const STATS = {
  totalCashPosition: '—',
  cashInflowMtd: '—',
  cashOutflowMtd: '—',
};

export default function CashAndBankPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Cash and Bank</h2>
      </div>

      <CashAndBankStatsRow isLoading={false} {...STATS} />

      <CashAndBankTable />
    </div>
  );
}
