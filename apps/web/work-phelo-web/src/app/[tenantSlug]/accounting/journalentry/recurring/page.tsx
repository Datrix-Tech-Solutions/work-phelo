'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { RecurringJournalsTable } from '@/components/organisms/accounting/tables/RecurringJournalsTable';

export default function RecurringJournalsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/accounting/journalentry`;

  return (
    <div className="flex flex-col gap-4 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1 [&>*]:shrink-0">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Journal Entries
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">Recurring Entries</span>
      </nav>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Recurring Entries</h2>
        <p className="text-sm text-gray-500">
          Templates that create a journal on a schedule. They run shortly after midnight UTC.
        </p>
      </div>

      <RecurringJournalsTable />
    </div>
  );
}
