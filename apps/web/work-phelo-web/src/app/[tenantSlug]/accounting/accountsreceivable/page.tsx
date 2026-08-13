'use client';

import { useState } from 'react';
import { AccountsReceivableStatsRow } from '@/components/molecules/accounting/AccountsReceivableStatsRow';
import { AccountsReceivableTable } from '@/components/organisms/accounting/tables/AccountsReceivableTable';
import { TradeCreditNotesTable } from '@/components/organisms/accounting/tables/TradeCreditNotesTable';
import { TradeSettlementsTable } from '@/components/organisms/accounting/tables/TradeSettlementsTable';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';
import { useAccountsReceivableSummary } from '@/hooks';

type AccountsReceivableTab = 'invoices' | 'credit-notes' | 'receipts';

const TABS: TabItem[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'receipts', label: 'Receipts' },
];

export default function AccountsReceivablePage() {
  const [activeTab, setActiveTab] = useState<AccountsReceivableTab>('invoices');
  const { data: summary, isLoading } = useAccountsReceivableSummary();
  const formatTotals = (totals: { currency: string; amount: string }[] | undefined) =>
    totals?.length
      ? totals
          .map(
            ({ currency, amount }) =>
              `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          )
          .join(' · ')
      : '—';

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Receivable</h2>
      </div>

      <AccountsReceivableStatsRow
        isLoading={isLoading}
        totalReceivables={formatTotals(summary?.outstandingByCurrency)}
        overdueInvoices={summary?.overdueInvoices ?? 0}
        dueThisWeek={summary?.dueThisWeek ?? 0}
        collectedMtd={formatTotals(summary?.collectedMtdByCurrency)}
      />

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as AccountsReceivableTab)}
        />
        {activeTab === 'invoices' && <AccountsReceivableTable />}
        {activeTab === 'credit-notes' && <TradeCreditNotesTable side="RECEIVABLE" />}
        {activeTab === 'receipts' && <TradeSettlementsTable side="RECEIVABLE" />}
      </div>
    </div>
  );
}
