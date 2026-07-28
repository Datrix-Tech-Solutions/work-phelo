'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement, usePlacementClaim } from '@/hooks';
import { ClaimOverviewSection } from '@/components/molecules/reinsurance/ClaimOverviewSection';
import { Button } from '@/components/atoms/Button';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const searchParams = useSearchParams();
  const placementId = searchParams.get('placementId') ?? '';
  const { data: placement } = useFacultativePlacement(placementId);
  const { data: activeClaim } = usePlacementClaim(placementId, id);
  const [panelOpen, setPanelOpen] = useState(false);

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
          <span className="text-gray-700 font-medium">
            {displayPolicyNumber(placement?.policyNumber)}
          </span>
        </nav>

        {placement && activeClaim && (
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            Edit Claim
          </Button>
        )}
      </div>

      <MakeClaimPanel
        isOpen={panelOpen}
        placement={placement}
        claim={activeClaim}
        onClose={() => setPanelOpen(false)}
      />

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {!placementId ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Missing placement context for this claim.
          </div>
        ) : placement && activeClaim ? (
          <ClaimOverviewSection placement={placement} claim={activeClaim} />
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
