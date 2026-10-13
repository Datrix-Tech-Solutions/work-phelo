'use client';

import { ArchiveTable } from '@/components/organisms/accounting/tables/ArchiveTable';

export default function ArchivePage() {
  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0 flex flex-col gap-1">
        <h2 className="text-base font-semibold text-gray-900">Archive</h2>
        <p className="text-sm text-gray-500">
          Voided entries. They count in no balance or report. While its period is open, an entry can
          be restored under its own number.
        </p>
      </div>

      <ArchiveTable />
    </div>
  );
}
