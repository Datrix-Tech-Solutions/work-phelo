'use client';

import { TransactionTypesTable } from '@/components/organisms/accounting/tables/TransactionTypesTable';

export default function TransactionTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Transaction Types</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define the transaction types available across cashbook and journal entries, and how each
          one classifies and posts.
        </p>
      </div>
      <TransactionTypesTable />
    </div>
  );
}
