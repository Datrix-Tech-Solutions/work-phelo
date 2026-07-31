'use client';

import { useRouter, useParams } from 'next/navigation';
import {
  Landmark,
  Handshake,
  ScrollText,
  ShieldCheck,
  BanknoteArrowDown,
  BanknoteArrowUp,
} from 'lucide-react';
import { ReportCard } from '@/components/molecules/shared/ReportCard';
import { useCedantsReport, useReinsurersReport, useFacultativeReport } from '@/hooks';

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(2)}K`;
  else formatted = value.toFixed(2);
  return symbol ? `${symbol} ${formatted}` : formatted;
}

export default function ReinsuranceReportsPage() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const base = `/${tenantSlug}/operations/reinsurance/reports`;

  const { summary: cedantsSummary, isLoading: loadingCedants } = useCedantsReport({});
  const { summary: reinsurersSummary, isLoading: loadingReinsurers } = useReinsurersReport({});
  const { summary: facultativeSummary, isLoading: loadingFacultative } = useFacultativeReport({});

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate reports across your reinsurance operations
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <ReportCard
          icon={<Landmark className="w-6 h-6" />}
          iconClassName="bg-blue-600 text-blue-100"
          title="Cedants"
          description="Business performance and placement activity by cedant."
          stats={[
            {
              label: 'Active Cedants',
              value: loadingCedants ? '—' : String(cedantsSummary.activeCedants),
            },
            {
              label: 'Total Premium',
              value: loadingCedants
                ? '—'
                : fmtAmount(cedantsSummary.totalPremium, cedantsSummary.currencySymbol),
            },
            {
              label: 'Outstanding',
              value: loadingCedants
                ? '—'
                : fmtAmount(cedantsSummary.outstanding, cedantsSummary.currencySymbol),
            },
          ]}
          onClick={() => router.push(`${base}/cedants`)}
        />

        <ReportCard
          icon={<Handshake className="w-6 h-6" />}
          iconClassName="bg-purple-600 text-purple-100"
          title="Reinsurers"
          description="Participation and revenue breakdown by reinsurer."
          stats={[
            {
              label: 'Active Reinsurers',
              value: loadingReinsurers ? '—' : String(reinsurersSummary.activeReinsurers),
            },
            {
              label: 'Ceded Premium',
              value: loadingReinsurers
                ? '—'
                : fmtAmount(reinsurersSummary.cededPremium, reinsurersSummary.currencySymbol),
            },
            {
              label: 'Outstanding',
              value: loadingReinsurers
                ? '—'
                : fmtAmount(reinsurersSummary.outstanding, reinsurersSummary.currencySymbol),
            },
          ]}
          onClick={() => router.push(`${base}/reinsurers`)}
        />

        <ReportCard
          icon={<ScrollText className="w-6 h-6" />}
          iconClassName="bg-emerald-600 text-emerald-100"
          title="Treaty"
          description="Treaty arrangements and distribution performance."
          stats={[
            { label: 'Active Treaties', value: '—' },
            { label: 'Ceded Premium', value: '—' },
          ]}
          onClick={() => router.push(`${base}/treaty`)}
        />

        <ReportCard
          icon={<ShieldCheck className="w-6 h-6" />}
          iconClassName="bg-amber-600 text-amber-100"
          title="Facultative"
          description="Facultative placement activity and closings."
          stats={[
            {
              label: 'Total Offers',
              value: loadingFacultative ? '—' : String(facultativeSummary.totalOffers),
            },
            {
              label: 'Open Offers',
              value: loadingFacultative ? '—' : String(facultativeSummary.openOffers),
            },
            {
              label: 'Acceptance Rate',
              value: loadingFacultative ? '—' : `${facultativeSummary.acceptanceRate.toFixed(1)}%`,
            },
          ]}
          onClick={() => router.push(`${base}/facultative`)}
        />

        <ReportCard
          icon={<BanknoteArrowDown className="w-6 h-6" />}
          iconClassName="bg-cyan-600 text-cyan-100"
          title="Premiums"
          description="Premium and payment history across placements."
          stats={[
            { label: 'Total Collected', value: '—' },
            { label: 'Outstanding', value: '—' },
          ]}
          onClick={() => router.push(`${base}/premiums`)}
        />

        <ReportCard
          icon={<BanknoteArrowUp className="w-6 h-6" />}
          iconClassName="bg-rose-600 text-rose-100"
          title="Claims"
          description="Claims activity and settlement history."
          stats={[
            { label: 'Open Claims', value: '—' },
            { label: 'Total Paid', value: '—' },
          ]}
          onClick={() => router.push(`${base}/claims`)}
        />
      </div>
    </div>
  );
}
