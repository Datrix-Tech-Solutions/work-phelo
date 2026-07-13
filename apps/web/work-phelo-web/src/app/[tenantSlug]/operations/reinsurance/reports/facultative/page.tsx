'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ReportHero } from '@/components/molecules/shared/ReportHero';
import { FacultativeReportFilters } from '@/components/molecules/reinsurance/reports/FacultativeReportFilters';
import { FacultativeReportSummary } from '@/components/molecules/reinsurance/reports/FacultativeReportSummary';
import { FacultativeReportTable } from '@/components/organisms/reinsurance/tables/FacultativeReportTable';
import { useFacultativeReport } from '@/hooks';
import { FacultativeReportParams } from '@/hooks/reinsurance/useFacultativeReport';

export default function FacultativeReportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/operations/reinsurance/reports`;
  const [reportParams, setReportParams] = useState<FacultativeReportParams | null>(null);

  const { rows, summary, isLoading } = useFacultativeReport(reportParams ?? { years: [] }, {
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
          <span className="text-gray-700 font-medium">Facultative</span>
        </nav>
      }
      leftPanel={<FacultativeReportFilters onGenerate={setReportParams} />}
      rightPanel={
        <>
          <ReportHero title="Facultative" years={reportParams?.years ?? []} />
          {!reportParams ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select fiscal year to generate report</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <FacultativeReportSummary summary={summary} isLoading={isLoading} />
              <div className="flex-1 min-h-0">
                <FacultativeReportTable rows={rows} isLoading={isLoading} />
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
