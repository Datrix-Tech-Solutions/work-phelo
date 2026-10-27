'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { MarketingReportView } from '@/components/organisms/marketing/MarketingReportView';
import { findReport } from '@/lib/marketing-reports';

export default function MarketingReportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; report: string }>;
}) {
  const { tenantSlug, report: key } = use(params);
  const base = `/${tenantSlug}/marketing/reports`;
  const report = findReport(key);

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Reports
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{report?.title ?? 'Report'}</span>
      </nav>
      {report ? (
        <MarketingReportView report={report} />
      ) : (
        <p className="py-16 text-center text-sm text-gray-400">This report does not exist.</p>
      )}
    </div>
  );
}
