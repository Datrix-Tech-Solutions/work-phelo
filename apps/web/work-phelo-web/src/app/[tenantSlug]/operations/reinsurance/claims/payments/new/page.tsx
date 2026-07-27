'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultatives, usePlacementClaims } from '@/hooks';
import AddClaimPaymentForm from '@/components/organisms/reinsurance/AddClaimPaymentForm';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

function SelectedClaimCard({ placementId }: { placementId: string }) {
  const { data: facultatives = [] } = useFacultatives();
  const { data: claims = [] } = usePlacementClaims(placementId);
  const placement = facultatives.find((f) => f.id === placementId);
  const claim = claims[0];

  if (!placement) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {displayPolicyNumber(placement.policyNumber)}
        </span>
        <span className="text-xs text-gray-400">{placement.cedant.name}</span>
      </div>
      {claim && (
        <>
          <span className="text-xs text-gray-500">{claim.claimNumber}</span>
          <span className="text-sm font-medium text-gray-900">
            {claim.currency}{' '}
            {parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount).toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
            )}
          </span>
        </>
      )}
    </div>
  );
}

export default function AddClaimPaymentPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState<string[]>([]);

  const hasSelection = useMemo(() => selectedPlacementIds.length > 0, [selectedPlacementIds]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/claims`}
            className="hover:text-gray-700 transition-colors"
          >
            Claims
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Make Payment</span>
        </nav>

        <AddClaimPaymentForm defaultOpen onPlacementsChange={setSelectedPlacementIds} />
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {hasSelection ? (
          <div className="flex flex-col gap-4">
            {selectedPlacementIds.map((id) => (
              <SelectedClaimCard key={id} placementId={id} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Select a cedant and claim to record a payment
          </div>
        )}
      </div>
    </div>
  );
}
