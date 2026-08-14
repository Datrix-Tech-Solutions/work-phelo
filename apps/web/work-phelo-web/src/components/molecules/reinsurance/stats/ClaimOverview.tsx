'use client';

import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Badge } from '@/components/atoms/Badge';
import { ClaimDetailsPanel } from '@/components/molecules/reinsurance/claim/ClaimDetailsPanel';
import { ClaimStatusActions } from '@/components/organisms/reinsurance/claim/ClaimStatusActions';
import { Facultative, PlacementClaim } from '@/types/reinsurance';
import { useCedants } from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';
import { CLAIM_STATUS_LABEL, CLAIM_STATUS_VARIANT } from '@/lib/reinsurance/claimStatus';

interface ClaimOverviewProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

/** Persistent, collapsible claim + placement summary shown above the claim detail tabs — mirrors
 * `FacultativeOverview`'s placement-overview card. Wraps `ClaimDetailsPanel` (policy terms, claim
 * facts, and the status-transition actions) so it stays visible across tabs instead of living
 * inside one of them. */
export function ClaimOverview({ placement, claim }: ClaimOverviewProps) {
  const { data: cedants = [] } = useCedants();
  const deductionRate = isForeignCedant(cedants.find((c) => c.id === placement.cedant.id))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;

  return (
    <CollapsibleOverview
      headerExtra={
        claim && (
          <>
            <span className="text-sm text-gray-500">|</span>
            <Badge
              label={CLAIM_STATUS_LABEL[claim.status]}
              variant={CLAIM_STATUS_VARIANT[claim.status]}
            />
          </>
        )
      }
    >
      <ClaimDetailsPanel
        placement={placement}
        claim={claim}
        deductionRate={deductionRate}
        statusActions={claim && <ClaimStatusActions placementId={placement.id} claim={claim} />}
      />
    </CollapsibleOverview>
  );
}
