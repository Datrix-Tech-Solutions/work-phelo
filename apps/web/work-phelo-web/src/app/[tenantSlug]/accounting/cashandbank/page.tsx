'use client';

import { StatCard } from '@/components/atoms/StatCard';
import { CashAndBankTable } from '@/components/organisms/accounting/tables/CashAndBankTable';

const SUMMARY_CARDS = [
  { label: 'Total Cash Position', value: '—', sub: 'Across all accounts' },
  { label: 'Cash Inflow (MTD)', value: '—', sub: 'Month-to-date' },
  { label: 'Cash Outflow (MTD)', value: '—', sub: 'Month-to-date' },
];

export default function CashAndBankPage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Cash and Bank</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        {SUMMARY_CARDS.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} sub={card.sub} />
        ))}
      </div>

      <CashAndBankTable />
    </div>
  );
}
