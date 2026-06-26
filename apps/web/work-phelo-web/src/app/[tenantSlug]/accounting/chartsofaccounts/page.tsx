'use client';

import { ChartOfAccountsTable } from '@/components/organisms/accounting/tables/ChartOfAccountsTable';

export default function ChartOfAccountsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Chart of Accounts</h2>
      </div>

      <ChartOfAccountsTable />
    </div>
  );
}
