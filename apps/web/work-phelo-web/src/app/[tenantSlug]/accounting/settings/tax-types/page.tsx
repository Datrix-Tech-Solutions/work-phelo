'use client';

import { TaxTypesTable } from '@/components/organisms/accounting/tables/TaxTypesTable';

export default function TaxTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Tax Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure tax codes and rates for your transactions
        </p>
      </div>
      <TaxTypesTable />
    </div>
  );
}
