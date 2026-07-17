'use client';

import { useEffect, useMemo } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Facultative, isEndorsementSentToMarket } from '@/types/reinsurance';
import { usePlacementEndorsements, usePlacementEffectiveView, usePlacementPayments } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { RAW_STATUS_VARIANT_MAP, rawStatusLabel } from '@/lib/reinsurance/placementStatus';

export type PaymentStatus = 'Outstanding' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

interface FacultativeOverviewProps {
  placement: Facultative;
  onPaymentStatusChange?: (status: PaymentStatus) => void;
}

export function FacultativeOverview({
  placement,
  onPaymentStatusChange,
}: FacultativeOverviewProps) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);
  const endorsementCount = endorsements.filter((e) => e.status !== 'VOID').length;
  const hasActiveEndorsement = endorsements.some((e) => isEndorsementSentToMarket(e.status));
  const { data: effectiveView } = usePlacementEffectiveView(placement.id, hasActiveEndorsement);
  const effectiveTotals = hasActiveEndorsement ? effectiveView?.effectiveTotals : undefined;

  const paymentStatus = useMemo<PaymentStatus>(() => {
    const facPrem =
      placement.premium != null && placement.facultativeOffer != null
        ? (placement.facultativeOffer / 100) * placement.premium
        : 0;
    const netPremium =
      placement.commission != null ? facPrem * (1 - placement.commission / 100) : facPrem;
    const paid = payments
      .filter((p) => p.status === 'RECORDED')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    if (netPremium > 0 && paid >= netPremium) return 'Paid';
    if (paid > 0) return 'Part Payment';
    return 'Outstanding';
  }, [payments, placement.premium, placement.facultativeOffer, placement.commission]);

  useEffect(() => {
    onPaymentStatusChange?.(paymentStatus);
  }, [paymentStatus, onPaymentStatusChange]);

  const facOffer = effectiveTotals?.facultativeOfferPercent ?? placement.facultativeOffer ?? 0;
  const premiumValue = effectiveTotals?.premium ?? placement.premium;
  const sumInsuredValue = effectiveTotals?.sumInsured ?? placement.sumInsured;
  const commissionValue = effectiveTotals?.commissionPercent ?? placement.commission;
  const facSumInsured = sumInsuredValue != null ? sumInsuredValue * (facOffer / 100) : null;
  const facPremium = premiumValue != null ? premiumValue * (facOffer / 100) : null;

  const riskEntries = [
    ...placementDetailEntries(placement.businessDetails),
    ...placementDetailEntries(placement.offerDetails),
  ];

  const statusLabel =
    placement.status === 'CLOSING' ? 'Partially Closed' : rawStatusLabel(placement.status);
  const statusVariant = RAW_STATUS_VARIANT_MAP[placement.status];

  return (
    <CollapsibleOverview
      headerExtra={
        <>
          <Badge label={statusLabel} variant={statusVariant} />
          <span className="text-sm text-gray-500">|</span>
          <span className={PAYMENT_STATUS_CLASS[paymentStatus]}>{paymentStatus}</span>
          {endorsementCount > 0 && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-xs text-gray-600 font-medium">
                {endorsementCount} endorsement{endorsementCount > 1 ? 's' : ''}
              </span>
            </>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Class of Risk" value={placement.classOfBusiness ?? '—'} />
        <DetailField label="Policy No." value={placement.reference} />
        <DetailField label="Reinsured" value={placement.cedant.name} />
        <DetailField label="Insured" value={placement.title} />
        <DetailField
          label="Period of Insurance"
          value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
        />
        {riskEntries.map((entry) => (
          <DetailField key={entry.key} label={entry.label} value={fmtFieldValue(entry.value)} />
        ))}
        <DetailField label="Rate (%)" value={placement.rate != null ? `${placement.rate}%` : '—'} />
        <DetailField
          label="Cedant Commission (%)"
          value={commissionValue != null ? `${commissionValue}%` : '—'}
        />
        <DetailField label="Fac. Offer (%)" value={`${facOffer}%`} />
        <DetailField label="Premium" value={fmtAmount(premiumValue, placement.currency)} />
        <DetailField label="Sum Insured" value={fmtAmount(sumInsuredValue, placement.currency)} />
        <DetailField
          label="Fac. Sum Insured"
          value={fmtAmount(facSumInsured, placement.currency)}
        />
        <DetailField label="Fac. Premium" value={fmtAmount(facPremium, placement.currency)} />
      </div>
    </CollapsibleOverview>
  );
}
