'use client';

import { Facultative, PlacementFinancialPosition } from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { cardClass } from '@/lib/utils';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PaymentBreakdownProps {
  placement?: Facultative | null;
  financialPosition?: PlacementFinancialPosition | null;
}

export function PaymentBreakdown({ placement, financialPosition }: PaymentBreakdownProps) {
  const { currency, reference, policyNumber, title, cedant, classOfBusiness } = placement ?? {
    currency: null,
    reference: null,
    policyNumber: null,
    title: null,
    cedant: null,
    classOfBusiness: null,
  };

  const position = financialPosition?.cedant;
  const positionCurrency = financialPosition?.currency ?? currency;
  const outstanding = position?.outstanding ?? 0;
  const isCredit = position?.position === 'CREDIT_BALANCE' || outstanding < 0;

  return (
    <div className={cardClass('flex flex-col gap-3 p-5')}>
      {reference && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">{reference}</span>
              {policyNumber && <span className="text-xs text-gray-400">{policyNumber}</span>}
            </div>
            {(title || cedant || classOfBusiness) && (
              <div className="flex items-center gap-3">
                {title && <span className="text-xs text-gray-600">{title}</span>}
                {title && classOfBusiness && <span className="text-gray-400 text-xs">·</span>}
                {cedant?.name && <span className="text-xs text-gray-400">{cedant.name}</span>}
                {cedant?.name && title && <span className="text-gray-400 text-xs">·</span>}
                {classOfBusiness && (
                  <span className="text-xs text-gray-400">{classOfBusiness}</span>
                )}
              </div>
            )}
          </div>
          <hr className="border-gray-100" />
        </>
      )}
      <DetailField
        horizontal
        label="Original Obligation"
        value={fmt(position?.originalObligation ?? 0, positionCurrency)}
      />
      <DetailField
        horizontal
        label="Endorsement Adjustments"
        value={fmt(position?.endorsementAdjustments ?? 0, positionCurrency)}
      />
      <DetailField
        horizontal
        label="Current Obligation"
        value={
          <span className="font-semibold text-gray-900">
            {fmt(position?.currentObligation ?? 0, positionCurrency)}
          </span>
        }
      />
      <DetailField
        horizontal
        label="Received"
        value={
          <span className="font-semibold text-gray-900">
            {fmt(position?.netSettled ?? 0, positionCurrency)}
          </span>
        }
      />
      <DetailField
        horizontal
        label={isCredit ? 'Credit / Refund Position' : 'Outstanding'}
        value={fmt(Math.abs(outstanding), positionCurrency)}
      />

      <hr className="border-gray-100" />

      <DetailField
        horizontal
        label="Gross Recorded"
        value={
          <span className="font-semibold text-gray-900">
            {fmt(position?.grossRecorded ?? 0, positionCurrency)}
          </span>
        }
      />
      <DetailField
        horizontal
        label="Reversed"
        value={
          <span className="font-semibold text-brand">
            {fmt(position?.reversed ?? 0, positionCurrency)}
          </span>
        }
      />
    </div>
  );
}
