import { ReactNode } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { cardClass } from '@/lib/utils';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { fmt, fmtDate } from '@/lib/reinsurance/claimFormat';
import { CLAIM_STATUS_LABEL, CLAIM_STATUS_VARIANT } from '@/lib/reinsurance/claimStatus';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

interface ClaimDetailsPanelProps {
  placement: Facultative;
  claim?: PlacementClaim;
  deductionRate: number;
  /** Rendered right below the status badge — kept as a slot so this stays a pure/presentational
   * molecule while the caller wires up the (hook-driven) status actions organism. */
  statusActions?: ReactNode;
}

/** Read-only placement + claim summary card — policy terms on top, claim facts below once a
 * claim exists. */
export function ClaimDetailsPanel({
  placement,
  claim,
  deductionRate,
  statusActions,
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
    <div className={cardClass('flex flex-col gap-3 p-5')}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {displayPolicyNumber(placement.policyNumber)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {placement.cedant?.name && (
            <span className="text-xs text-gray-600">{placement.cedant.name}</span>
          )}
          {placement.cedant?.name && placement.title && (
            <span className="text-gray-400 text-xs">·</span>
          )}
          {placement.title && <span className="text-xs text-gray-400">{placement.title}</span>}
          {placement.classOfBusiness && (
            <>
              <span className="text-gray-400 text-xs">·</span>
              <span className="text-xs text-gray-400">{placement.classOfBusiness}</span>
            </>
          )}
        </div>
      </div>

      <hr className="border-gray-100" />

      <DetailField
        horizontal
        label="Facultative Offer"
        value={facultativeOffer != null ? `${facultativeOffer}%` : '—'}
      />
      <DetailField horizontal label="Fac. Sum Insured" value={fmt(facSumInsured, currency)} />
      <DetailField
        horizontal
        label="Period of Insurance"
        value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
      />
      <DetailField
        horizontal
        label="Fac. Premium"
        value={<span className="font-semibold text-gray-900">{fmt(netPremium, currency)}</span>}
      />
      <DetailField horizontal label="Created At" value={fmtDate(createdAt)} />

      {claim && (
        <>
          <hr className="border-gray-100" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{claim.claimNumber}</span>
            <Badge
              label={CLAIM_STATUS_LABEL[claim.status]}
              variant={CLAIM_STATUS_VARIANT[claim.status]}
            />
          </div>

          {statusActions}

          <DetailField horizontal label="Occurrence Date" value={fmtDate(claim.occurrenceDate)} />
          <DetailField horizontal label="Reported Date" value={fmtDate(claim.reportedDate)} />
          <DetailField horizontal label="Claim Cause" value={claim.claimCause} />
          {claim.occurrenceDetails && (
            <DetailField horizontal label="Details" value={claim.occurrenceDetails} />
          )}
          <DetailField
            horizontal
            label="Estimated Loss"
            value={
              <span className="font-semibold text-gray-900">
                {fmt(claim.estimatedLossAmount, claim.currency)}
              </span>
            }
          />
          {claim.finalLossAmount && (
            <DetailField
              horizontal
              label="Final Loss"
              value={
                <span className="font-semibold text-gray-900">
                  {fmt(claim.finalLossAmount, claim.currency)}
                </span>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
