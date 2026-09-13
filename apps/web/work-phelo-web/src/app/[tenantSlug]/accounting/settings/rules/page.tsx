'use client';

import { TransactionTypeRulesTable } from '@/components/organisms/accounting/tables/TransactionTypeRulesTable';

export default function RulesPage() {
  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Rules</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define how each transaction type posts to the general ledger, by source and role.
        </p>
      </div>
      <TransactionTypeRulesTable />
    </div>
  );
}
