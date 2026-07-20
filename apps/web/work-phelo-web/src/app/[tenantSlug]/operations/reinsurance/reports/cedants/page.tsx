'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ReportHero } from '@/components/molecules/shared/ReportHero';
import { CedantsReportFilters } from '@/components/molecules/reinsurance/reports/CedantsReportFilters';
import { CedantsReportSummary } from '@/components/molecules/reinsurance/reports/CedantsReportSummary';
import { CedantsReportTable } from '@/components/organisms/reinsurance/tables/CedantsReportTable';
import { useCedantsReport } from '@/hooks';
import { CedantsReportParams } from '@/hooks/reinsurance/useCedantsReport';

export default function CedantsReportPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/operations/reinsurance/reports`;
  const [reportParams, setReportParams] = useState<CedantsReportParams | null>(null);

  const { rows, summary, currencyTotals, isLoading } = useCedantsReport(
    reportParams ?? { years: [] },
    {
      enabled: reportParams !== null,
    },
  );

  return (
    <TwoPanelShell
      header={
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Cedants</span>
        </nav>
      }
      leftPanel={<CedantsReportFilters onGenerate={setReportParams} />}
      rightPanel={
        <>
          <ReportHero title="Cedants" years={reportParams?.years ?? []} />
          {!reportParams ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select fiscal year to generate report</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <CedantsReportSummary currencyTotals={currencyTotals} isLoading={isLoading} />
              <div className="flex-1 min-h-0">
                <CedantsReportTable
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
