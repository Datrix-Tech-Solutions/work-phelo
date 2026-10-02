'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { JournalEntriesTable } from '@/components/organisms/accounting/tables/JournalEntriesTable';

export default function JournalEntryPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-900">Journal Entries</h2>
        <Link
          href={`/${tenantSlug}/accounting/journalentry/recurring`}
          className="text-sm font-medium text-brand hover:underline"
        >
          Recurring entries
        </Link>
      </div>

      <JournalEntriesTable />
    </div>
  );
}
