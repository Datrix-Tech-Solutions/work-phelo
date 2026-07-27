'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent, pagePx } from '@/lib/layout';
import { NewJournalEntryForm } from '@/components/organisms/accounting/forms/NewJournalEntryForm';

export default function NewJournalEntryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0 flex items-center`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/accounting/journalentry`}
            className="hover:text-gray-700 transition-colors"
          >
            Journal Entries
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">New Journal Entry</span>
        </nav>
      </div>

      {/* Heading */}
      <div className={`${pagePx} pt-4 pb-2 shrink-0`}>
        <h2 className="text-base font-semibold text-gray-900">New Journal Entry</h2>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        <NewJournalEntryForm
          onCancel={() => router.push(`/${tenantSlug}/accounting/journalentry`)}
          onSaved={() => router.push(`/${tenantSlug}/accounting/journalentry`)}
        />
      </div>
    </div>
  );
}
