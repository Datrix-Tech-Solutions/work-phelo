'use client';

import { useRouter, useParams } from 'next/navigation';
import {
  Landmark,
  Handshake,
  // ScrollText,
  ShieldCheck,
  BanknoteArrowDown,
  BanknoteArrowUp,
} from 'lucide-react';
import { ReportCard } from '@/components/molecules/shared/ReportCard';

const ON_DEMAND_STATS = [
  { label: 'Load', value: 'On demand' },
  { label: 'Opens', value: 'Report page' },
];

export default function ReinsuranceReportsPage() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const base = `/${tenantSlug}/operations/reinsurance/reports`;

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
          icon={<ShieldCheck className="w-6 h-6" />}
          iconClassName="bg-amber-600 text-amber-100"
          title="Facultative"
          description="Facultative placement activity and closings."
          stats={ON_DEMAND_STATS}
          onClick={() => router.push(`${base}/facultative`)}
        />
        <ReportCard
          icon={<Landmark className="w-6 h-6" />}
          iconClassName="bg-blue-600 text-blue-100"
          title="Cedants"
          description="Business performance and placement activity by cedant."
          stats={ON_DEMAND_STATS}
          onClick={() => router.push(`${base}/cedants`)}
        />

        <ReportCard
          icon={<Handshake className="w-6 h-6" />}
          iconClassName="bg-purple-600 text-purple-100"
          title="Reinsurers"
          description="Participation and revenue breakdown by reinsurer."
          stats={ON_DEMAND_STATS}
          onClick={() => router.push(`${base}/reinsurers`)}
        />

        {/* <ReportCard
          icon={<ScrollText className="w-6 h-6" />}
          iconClassName="bg-emerald-600 text-emerald-100"
          title="Treaty"
          description="Treaty arrangements and distribution performance."
          stats={[
            { label: 'Active Treaties', value: '—' },
            { label: 'Ceded Premium', value: '—' },
          ]}
          onClick={() => router.push(`${base}/treaty`)}
        /> */}

        <ReportCard
          icon={<BanknoteArrowDown className="w-6 h-6" />}
          iconClassName="bg-cyan-600 text-cyan-100"
          title="Premiums"
          description="Premium and payment history across placements."
          stats={ON_DEMAND_STATS}
          onClick={() => router.push(`${base}/premiums`)}
        />

        <ReportCard
          icon={<BanknoteArrowUp className="w-6 h-6" />}
          iconClassName="bg-rose-600 text-rose-100"
          title="Claims"
          description="Claims activity and settlement history."
          stats={ON_DEMAND_STATS}
          onClick={() => router.push(`${base}/claims`)}
        />
      </div>
    </div>
  );
}
