'use client';

import { SourceTypesTable } from '@/components/organisms/accounting/tables/SourceTypesTable';

export default function SourceTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Source Types</h2>
        <p className="mt-1 text-sm text-gray-500">
          Other modules that have linked their transactions into Accounting. These appear
          automatically once a module&apos;s own integration setup is completed — link or unlink
          them here, or manage the setup itself from that module&apos;s settings.
        </p>
      </div>
      <SourceTypesTable />
    </div>
  );
}
