'use client';

import { TaxTypesTable } from '@/components/organisms/accounting/tables/TaxTypesTable';

export default function TaxTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Tax Types</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tax rates a rule’s tax lines can pick from — set the rate once here, reused everywhere
          that tax is referenced.
        </p>
      </div>
      <TaxTypesTable />
    </div>
  );
}
