'use client';

import { TransactionsTable } from '@/components/organisms/accounting/tables/TransactionsTable';

export default function TransactionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 min-h-0">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Transactions</h2>
        
      </div>
      <TransactionsTable />
    </div>
  );
}
