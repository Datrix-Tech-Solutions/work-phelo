'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useClaimAllocations, useFacultativePlacement, usePlacementClaims } from '@/hooks';
import { ClaimOverviewSection } from '@/components/molecules/reinsurance/ClaimOverviewSection';
import { ClaimAllocationsSection } from '@/components/molecules/reinsurance/ClaimAllocationsSection';
import { Button } from '@/components/atoms/Button';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: placement, isLoading: placementLoading } = useFacultativePlacement(id);
  const {
    data: claims = [],
    isLoading: claimsLoading,
    isError: claimsError,
  } = usePlacementClaims(id);
  const [panelOpen, setPanelOpen] = useState(false);
  const requestedClaimId = searchParams.get('claimId');
  const claim = useMemo(
    () => claims.find((item) => item.id === requestedClaimId) ?? claims[0] ?? null,
    [claims, requestedClaimId],
  );
  const { data: allocations = [] } = useClaimAllocations(id, claim?.id ?? '');

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
          <span className="text-gray-700 font-medium">{placement?.reference ?? '—'}</span>
          {claim && (
            <>
              <Icons.ChevronRight className="w-5 h-5" />
              <span className="text-gray-700 font-medium">{claim.claimNumber}</span>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {claims.length > 1 && claim && (
            <select
              value={claim.id}
              onChange={(event) =>
                router.replace(
                  `/${tenantSlug}/operations/reinsurance/claims/${id}?claimId=${event.target.value}`,
                )
              }
              className="rounded-input border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              aria-label="Select claim"
            >
              {claims.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.claimNumber} · {item.claimCause}
                </option>
              ))}
            </select>
          )}
          {placement && (
            <Button size="sm" onClick={() => setPanelOpen(true)}>
              Record Claim
            </Button>
          )}
        </div>
      </div>

      <MakeClaimPanel
        isOpen={panelOpen}
        placement={placement}
        onClose={() => setPanelOpen(false)}
        onSuccess={(createdClaim) => {
          router.replace(
            `/${tenantSlug}/operations/reinsurance/claims/${id}?claimId=${createdClaim.id}`,
          );
        }}
      />

      <div className={`${pageContent} flex-1 overflow-y-auto flex flex-col gap-4`}>
        {placementLoading || claimsLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading claim…
          </div>
        ) : claimsError ? (
          <div className="flex items-center justify-center h-40 text-sm text-red-600">
            Claim records could not be loaded. Please refresh and try again.
          </div>
        ) : placement && claim ? (
          <>
            <ClaimOverviewSection
              placement={placement}
              claimAmount={Number(claim.finalLossAmount ?? claim.estimatedLossAmount)}
              claimDate={claim.occurrenceDate}
              allocations={allocations}
            />
            <ClaimAllocationsSection placementId={placement.id} claim={claim} />
          </>
        ) : placement ? (
          <div className="flex flex-col items-center justify-center gap-4 h-52 rounded-xl border border-gray-200 bg-white text-center">
            <div>
              <p className="text-sm font-semibold text-gray-900">No claims recorded</p>
              <p className="mt-1 text-sm text-gray-500">
                Record the first loss event for this placement.
              </p>
            </div>
            <Button size="sm" onClick={() => setPanelOpen(true)}>
              Record Claim
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-red-600">
            Placement could not be loaded.
          </div>
        )}
      </div>
    </div>
  );
}
