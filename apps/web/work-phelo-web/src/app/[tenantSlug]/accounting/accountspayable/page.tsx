'use client';

import { StatCard } from '@/components/atoms/StatCard';
import { AccountsPayableTable } from '@/components/organisms/accounting/tables/AccountsPayableTable';

const SUMMARY_CARDS = [
  { label: 'Total Payables', value: '—', sub: 'All outstanding invoices' },
  { label: 'Overdue Invoices', value: '—', sub: 'Past due date' },
  { label: 'Due This Week', value: '—', sub: 'Invoices due in 7 days' },
  { label: 'Pending Approval', value: '—', sub: 'Awaiting approval' },
];

export default function AccountsPayablePage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Payable</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {SUMMARY_CARDS.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} sub={card.sub} />
        ))}
      </div>

      <AccountsPayableTable />
    </div>
  );
}
