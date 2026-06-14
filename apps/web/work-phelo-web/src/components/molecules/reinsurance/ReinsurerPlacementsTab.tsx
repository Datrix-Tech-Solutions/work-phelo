'use client';

import { StatCard } from '@/components/atoms/StatCard';
import {
  ReinsurerPoliciesTable,
  type ReinsurerParticipation,
} from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';

interface ReinsurerPlacementsTabProps {
  participations: ReinsurerParticipation[];
  isLoading: boolean;
  onView: (id: string, reference: string) => void;
}

export function ReinsurerPlacementsTab({
  participations,
  isLoading,
  onView,
}: ReinsurerPlacementsTabProps) {
  const accepted = participations.filter((p) => p.participantStatus === 'ACCEPTED').length;
  const closed = participations.filter(
    (p) =>
      p.placementStatus === 'PARTIALLY_PLACED' ||
      p.placementStatus === 'PLACED' ||
      p.placementStatus === 'CLOSED',
  ).length;
  const pending = participations.filter(
    (p) => p.placementStatus === 'DRAFT' || p.placementStatus === 'MARKETING',
  ).length;
  const rejected = participations.filter((p) => p.participantStatus === 'DECLINED').length;
  const decided = accepted + rejected;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

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
        <h3 className="text-sm font-semibold text-gray-900">Offers</h3>
        <ReinsurerPoliciesTable
          data={participations}
          isLoading={isLoading}
          onRowClick={(id) => {
            const participation = participations.find((p) => p.id === id);
            if (participation) onView(participation.id, participation.reference);
          }}
        />
      </div>
    </div>
  );
}
