'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ReportHero } from '@/components/molecules/shared/ReportHero';
import { ReinsurersReportFilters } from '@/components/molecules/reinsurance/reports/ReinsurersReportFilters';
import { ReinsurersReportSummary } from '@/components/molecules/reinsurance/reports/ReinsurersReportSummary';
import { ReinsurersReportTable } from '@/components/organisms/reinsurance/tables/ReinsurersReportTable';
import { useReinsurersReport } from '@/hooks';
import { ReinsurersReportParams } from '@/hooks/reinsurance/useReinsurersReport';

export default function ReinsurersReportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/operations/reinsurance/reports`;
  const [reportParams, setReportParams] = useState<ReinsurersReportParams | null>(null);

  const { rows, summary, isLoading } = useReinsurersReport(reportParams ?? { years: [] }, {
    enabled: reportParams !== null,
  });

  return (
    <TwoPanelShell
      header={
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Reinsurers</span>
        </nav>
      }
      leftPanel={<ReinsurersReportFilters onGenerate={setReportParams} />}
      rightPanel={
        <>
          <ReportHero title="Reinsurers" years={reportParams?.years ?? []} />
          {!reportParams ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select fiscal year to generate report</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <ReinsurersReportSummary summary={summary} isLoading={isLoading} />
              <div className="flex-1 min-h-0">
                <ReinsurersReportTable
                  rows={rows}
                  currencySymbol={summary.currencySymbol}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
