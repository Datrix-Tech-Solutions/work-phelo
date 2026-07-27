'use client';

import { ClaimsTable } from '@/components/organisms/reinsurance/tables/Claimstable';
import { ClaimsStatsRow } from '@/components/molecules/reinsurance/stats/ClaimsStatsRow';

export default function ReinsuranceClaimsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Claims</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage claim submissions and processing</p>
      </div>
      <ClaimsStatsRow />
      <ClaimsTable />
    </div>
  );
}
