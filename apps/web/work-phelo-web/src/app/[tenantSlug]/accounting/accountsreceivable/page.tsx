'use client';

import { StatCard } from '@/components/atoms/StatCard';
import { AccountsReceivableTable } from '@/components/organisms/accounting/tables/AccountsReceivableTable';

const SUMMARY_CARDS = [
  { label: 'Total Receivables', value: '—', sub: 'All outstanding invoices' },
  { label: 'Overdue Invoices', value: '—', sub: 'Past due date' },
  { label: 'Due This Week', value: '—', sub: 'Invoices due in 7 days' },
  { label: 'Collected (MTD)', value: '—', sub: 'Month-to-date collections' },
];

export default function AccountsReceivablePage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Receivable</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {SUMMARY_CARDS.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} sub={card.sub} />
        ))}
      </div>

      <AccountsReceivableTable />
    </div>
  );
}
