'use client';

import { Facultative } from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PaymentBreakdownProps {
  placement?: Facultative | null;
  paidAmount?: number;
}

export function PaymentBreakdown({ placement, paidAmount }: PaymentBreakdownProps) {
  const {
    premium,
    commission,
    facultativeOffer,
    currency,
    reference,
    policyNumber,
    title,
    cedant,
    classOfBusiness,
  } = placement ?? {
    premium: 0,
    commission: 0,
    facultativeOffer: 0,
    currency: null,
    reference: null,
    policyNumber: null,
    title: null,
    cedant: null,
    classOfBusiness: null,
  };

  const grossPremium = premium ?? 0;
  const facOffer = facultativeOffer ?? 0;
  const commissionRate = commission ?? 0;

  const facPremium = (facOffer / 100) * grossPremium;
  const netPremium = facPremium * (1 - commissionRate / 100);

  const premiumToBePaid = Math.min(paidAmount ?? 0, netPremium);
  const premiumBalance = netPremium - premiumToBePaid;

  const bankBalance = premiumToBePaid;
  const reinsurers = bankBalance;

  return (
    <div className="bg-white rounded-xl p-5 flex flex-col gap-3">
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
      <DetailField horizontal label="Gross Premium" value={fmt(grossPremium, currency)} />
      <DetailField
        horizontal
        label="Premium"
        value={<span className="font-semibold text-gray-900">{fmt(netPremium, currency)}</span>}
      />
      <DetailField
        horizontal
        label="Premium to be Paid"
        value={
          <span className="font-semibold text-gray-900">{fmt(premiumToBePaid, currency)}</span>
        }
      />
      <DetailField horizontal label="Premium Balance" value={fmt(premiumBalance, currency)} />

      <hr className="border-gray-100" />

      <DetailField
        horizontal
        label="Bank Balance"
        value={<span className="font-semibold text-gray-900">{fmt(bankBalance, currency)}</span>}
      />
      <DetailField
        horizontal
        label="Reinsurers"
        value={<span className="font-semibold text-brand">{fmt(reinsurers, currency)}</span>}
      />
    </div>
  );
}
