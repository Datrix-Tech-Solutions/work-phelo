'use client';

import { useState } from 'react';
import { Facultative } from '@/types/reinsurance';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { ReinsurersPaymentTable } from '@/components/molecules/reinsurance/tables/ReinsurersPaymentTable';
import { cardClass } from '@/lib/utils';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface BusinessPaymentSectionProps {
  placement: Facultative;
  paidAmount?: number;
}

export function BusinessPaymentSection({ placement, paidAmount }: BusinessPaymentSectionProps) {
  const [total, setTotal] = useState(0);

  return (
    <div className={cardClass('flex flex-col gap-4 p-4')}>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:flex-1 min-w-0">
          <PaymentBreakdown placement={placement} paidAmount={paidAmount} />
        </div>
        <div className="w-full md:flex-2 min-w-0">
          <ReinsurersPaymentTable
            placement={placement}
            participants={placement.participants}
            grossPremium={placement.premium ?? 0}
            commission={placement.commission ?? 0}
            currency={placement.currency}
            cedantId={placement.cedant.id}
            paidAmount={paidAmount}
            onTotalChange={setTotal}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">Total</span>
        <span className="font-semibold text-gray-900">{fmt(total, placement.currency)}</span>
      </div>
    </div>
  );
}
