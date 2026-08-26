'use client';

import { SourceTypesTable } from '@/components/organisms/accounting/tables/SourceTypesTable';

export default function SourceTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Source Types</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define where transactions can originate from, used to classify transaction types.
        </p>
      </div>
      <SourceTypesTable />
    </div>
  );
}
