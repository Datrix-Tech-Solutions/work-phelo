'use client';

import { useState } from 'react';
import { AccountsPayableStatsRow } from '@/components/molecules/accounting/AccountsPayableStatsRow';
import { AccountsPayableTable } from '@/components/organisms/accounting/tables/AccountsPayableTable';
import { TradeCreditNotesTable } from '@/components/organisms/accounting/tables/TradeCreditNotesTable';
import { TradeSettlementsTable } from '@/components/organisms/accounting/tables/TradeSettlementsTable';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';

// TODO: replace with useAccountsPayableStats() hook once API is ready
const STATS = {
  totalPayables: '—',
  overdueInvoices: 0,
  dueThisWeek: 0,
  pendingApproval: 0,
};

type AccountsPayableTab = 'invoices' | 'credit-notes' | 'payments';

const TABS: TabItem[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'payments', label: 'Payments' },
];

export default function AccountsPayablePage() {
  const [activeTab, setActiveTab] = useState<AccountsPayableTab>('invoices');

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Payable</h2>
      </div>

      <AccountsPayableStatsRow isLoading={false} {...STATS} />

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as AccountsPayableTab)}
        />
        {activeTab === 'invoices' && <AccountsPayableTable />}
        {activeTab === 'credit-notes' && <TradeCreditNotesTable side="PAYABLE" />}
        {activeTab === 'payments' && <TradeSettlementsTable side="PAYABLE" />}
      </div>
    </div>
  );
}
