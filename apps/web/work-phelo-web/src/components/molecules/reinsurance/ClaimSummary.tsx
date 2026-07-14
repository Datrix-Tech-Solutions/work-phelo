'use client';

import { Facultative } from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { cardClass } from '@/lib/utils';

function fmt(val: number | null, currency: string | null) {
  if (val == null) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ClaimSummaryProps {
  placement?: Facultative | null;
}

export function ClaimSummary({ placement }: ClaimSummaryProps) {
  const {
    reference,
    policyNumber,
    title,
    cedant,
    classOfBusiness,
    currency,
    premium,
    sumInsured,
    status,
  } = placement ?? {
    reference: null,
    policyNumber: null,
    title: null,
    cedant: null,
    classOfBusiness: null,
    currency: null,
    premium: null,
    sumInsured: null,
    status: null,
  };

  return (
    <div className={cardClass('flex flex-col gap-3 p-5', 'glass')}>
      {reference ? (
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
                {cedant?.name && classOfBusiness && (
                  <span className="text-gray-400 text-xs">·</span>
                )}
                {classOfBusiness && (
                  <span className="text-xs text-gray-400">{classOfBusiness}</span>
                )}
              </div>
            )}
          </div>
          <hr className="border-gray-100" />
        </>
      ) : (
        <p className="text-sm text-gray-400">Select a placement to see its summary.</p>
      )}

      <DetailField horizontal label="Sum Insured" value={fmt(sumInsured, currency)} />
      <DetailField
        horizontal
        label="Premium"
        value={<span className="font-semibold text-gray-900">{fmt(premium, currency)}</span>}
      />
      <DetailField horizontal label="Status" value={status ?? '—'} />
    </div>
  );
}
