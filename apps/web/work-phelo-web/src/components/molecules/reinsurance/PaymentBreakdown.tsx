'use client';

import { Facultative, PlacementFinancialPosition } from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { fmtDate } from '@/lib/reinsurance/claimFormat';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PaymentBreakdownProps {
  placement?: Facultative | null;
  financialPosition?: PlacementFinancialPosition | null;
}

/** Placement facts + premium position figures, in the same `DetailField` tile grid format as
 * `FacultativeOverview`/`ClaimDetailsPanel`. Rendered inside `PaymentOverview`'s
 * `CollapsibleOverview` card, so it stays unboxed here rather than wrapping itself in another
 * card. */
export function PaymentBreakdown({ placement, financialPosition }: PaymentBreakdownProps) {
  const { policyNumber, title, cedant, classOfBusiness, inceptionDate, expiryDate, currency } =
    placement ?? {
      policyNumber: null,
      title: null,
      cedant: null,
      classOfBusiness: null,
      inceptionDate: null,
      expiryDate: null,
      currency: null,
    };

  const position = financialPosition?.cedant;
  const positionCurrency = financialPosition?.currency ?? currency;
  const outstanding = position?.outstanding ?? 0;
  const isCredit = position?.position === 'CREDIT_BALANCE' || outstanding < 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
      <DetailField label="Policy No." value={displayPolicyNumber(policyNumber)} />
      <DetailField label="Reinsured" value={cedant?.name ?? '—'} />
      <DetailField label="Insured" value={title ?? '—'} />
      <DetailField label="Class of Risk" value={classOfBusiness ?? '—'} />
      <DetailField
        label="Period of Insurance"
        value={`${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`}
      />
      <DetailField
        label="Original Premium"
        value={fmt(position?.originalObligation ?? 0, positionCurrency)}
      />
      <DetailField
        label="Endorsement Premium"
        value={fmt(position?.endorsementAdjustments ?? 0, positionCurrency)}
      />
      <DetailField
        label="Current Premium"
        value={fmt(position?.currentObligation ?? 0, positionCurrency)}
      />
      <DetailField label="Received" value={fmt(position?.netSettled ?? 0, positionCurrency)} />
      <DetailField
        label={isCredit ? 'Credit / Refund Position' : 'Outstanding'}
        value={fmt(Math.abs(outstanding), positionCurrency)}
      />
      <DetailField
        label="Gross Recorded"
        value={fmt(position?.grossRecorded ?? 0, positionCurrency)}
      />
      <DetailField label="Reversed" value={fmt(position?.reversed ?? 0, positionCurrency)} />
    </div>
  );
}
