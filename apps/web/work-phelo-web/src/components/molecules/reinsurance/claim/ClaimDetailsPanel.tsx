import { ReactNode } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { fmt, fmtDate } from '@/lib/reinsurance/claimFormat';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

interface ClaimDetailsPanelProps {
  placement: Facultative;
  claim?: PlacementClaim;
  deductionRate: number;
  /** Rendered right below the fact grid — kept as a slot so this stays a pure/presentational
   * molecule while the caller wires up the (hook-driven) status actions organism. */
  statusActions?: ReactNode;
}

/** Read-only placement + claim summary — a fact grid in the same `DetailField` tile format as
 * `FacultativeOverview`, rendered inside `ClaimOverview`'s `CollapsibleOverview` card. */
export function ClaimDetailsPanel({
  placement,
  claim,
  deductionRate,
  // statusActions,
}: ClaimDetailsPanelProps) {
  const { facultativeOffer, sumInsured, premium, commission, currency, createdAt } = placement;

  const facSumInsured =
    sumInsured != null && facultativeOffer != null ? sumInsured * (facultativeOffer / 100) : null;

  const facPremium =
    premium != null && facultativeOffer != null ? (facultativeOffer / 100) * premium : null;

  const netPremium =
    facPremium != null && commission != null
      ? facPremium * (1 - commission / 100) - facPremium * deductionRate
      : facPremium;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Policy No." value={displayPolicyNumber(placement.policyNumber)} />
        <DetailField label="Reinsured" value={placement.cedant?.name ?? '—'} />
        <DetailField label="Insured" value={placement.title ?? '—'} />
        <DetailField label="Class of Risk" value={placement.classOfBusiness ?? '—'} />
        <DetailField
          label="Period of Insurance"
          value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
        />
        <DetailField
          label="Facultative Offer"
          value={facultativeOffer != null ? `${facultativeOffer}%` : '—'}
        />
        <DetailField label="Fac. Sum Insured" value={fmt(facSumInsured, currency)} />
        <DetailField label="Fac. Premium" value={fmt(netPremium, currency)} />
        <DetailField label="Created At" value={fmtDate(createdAt)} />

        {claim && (
          <>
            <DetailField label="Claim Number" value={claim.claimNumber} />
            <DetailField label="Occurrence Date" value={fmtDate(claim.occurrenceDate)} />
            <DetailField label="Reported Date" value={fmtDate(claim.reportedDate)} />
            <DetailField label="Claim Cause" value={claim.claimCause} />
            {claim.occurrenceDetails && (
              <DetailField label="Details" value={claim.occurrenceDetails} />
            )}
            <DetailField
              label="Estimated Loss"
              value={fmt(claim.estimatedLossAmount, claim.currency)}
            />
            {claim.finalLossAmount && (
              <DetailField label="Final Loss" value={fmt(claim.finalLossAmount, claim.currency)} />
            )}
            {claim.approvedPayableAmount && (
              <DetailField
                label="Approved Payable"
                value={fmt(claim.approvedPayableAmount, claim.currency)}
              />
            )}
          </>
        )}
      </div>

      {/* {statusActions} */}
    </div>
  );
}
