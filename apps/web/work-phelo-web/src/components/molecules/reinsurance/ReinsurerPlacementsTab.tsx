'use client';

import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/atoms/StatCard';
import {
  ReinsurerPoliciesTable,
  type ReinsurerParticipation,
} from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';

interface ReinsurerPlacementsTabProps {
  participations: ReinsurerParticipation[];
  isLoading: boolean;
  tenantSlug: string;
}

export function ReinsurerPlacementsTab({
  participations,
  isLoading,
  tenantSlug,
}: ReinsurerPlacementsTabProps) {
  const router = useRouter();

  const accepted = participations.filter((p) => p.participantStatus === 'ACCEPTED').length;
  const closed = participations.filter((p) => p.participantStatus === 'CLOSED').length;
  const pending = participations.filter((p) =>
    ['INVITED', 'OFFER_SENT', 'QUOTED'].includes(p.participantStatus),
  ).length;
  const rejected = participations.filter((p) => p.participantStatus === 'DECLINED').length;
  const decided = accepted + closed + rejected;
  const acceptanceRate = decided > 0 ? Math.round(((accepted + closed) / decided) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Accepted Offers"
          value={accepted}
          sub="Offer accepted and awaiting closing"
        />
        <StatCard label="Closed Offers" value={closed} sub="Fully closed participations" />
        <StatCard label="Pending Offers" value={pending} sub="Offers sent and awaiting response" />
        <StatCard label="Declined Offers" value={rejected} sub="Offers declined" />
        <StatCard
          label="Acceptance Rate"
          value={acceptanceRate !== null ? `${acceptanceRate}%` : '—'}
          sub="Accepted & closed / total decided"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Facultative Placements</h3>
        <ReinsurerPoliciesTable
          data={participations}
          isLoading={isLoading}
          onRowClick={(id) =>
            router.push(`/${tenantSlug}/operations/reinsurance/facultative/${id}`)
          }
        />
      </div>
    </div>
  );
}
