'use client';

import { AccountsReceivableStatsRow } from '@/components/molecules/accounting/AccountsReceivableStatsRow';
import { AccountsReceivableTable } from '@/components/organisms/accounting/tables/AccountsReceivableTable';

// TODO: replace with useAccountsReceivableStats() hook once API is ready
const STATS = {
  totalReceivables: '—',
  overdueInvoices: 0,
  dueThisWeek: 0,
  collectedMtd: '—',
};

export default function AccountsReceivablePage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Receivable</h2>
      </div>

      <AccountsReceivableStatsRow isLoading={false} {...STATS} />

      <AccountsReceivableTable />
    </div>
  );
}
