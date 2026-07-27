'use client';

import { AccountsPayableStatsRow } from '@/components/molecules/accounting/AccountsPayableStatsRow';
import { AccountsPayableTable } from '@/components/organisms/accounting/tables/AccountsPayableTable';

// TODO: replace with useAccountsPayableStats() hook once API is ready
const STATS = {
  totalPayables: '—',
  overdueInvoices: 0,
  dueThisWeek: 0,
  pendingApproval: 0,
};

export default function AccountsPayablePage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Payable</h2>
      </div>

      <AccountsPayableStatsRow isLoading={false} {...STATS} />

      <AccountsPayableTable />
    </div>
  );
}
