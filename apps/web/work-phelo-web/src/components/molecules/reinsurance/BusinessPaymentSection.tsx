'use client';

import { useState } from 'react';
import { Facultative } from '@/types/reinsurance';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { ReinsurersPaymentTable } from '@/components/molecules/reinsurance/tables/ReinsurersPaymentTable';
import { usePlacementFinancialPosition } from '@/hooks/reinsurance/usePayments';
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
  const { data: financialPosition } = usePlacementFinancialPosition(placement.id);
  const currency = financialPosition?.currency ?? placement.currency;

  return (
    <div className={cardClass('flex flex-col gap-4 p-4')}>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:flex-1 min-w-0">
          <PaymentBreakdown placement={placement} financialPosition={financialPosition} />
        </div>
        <div className="w-full md:flex-2 min-w-0">
          <ReinsurersPaymentTable
            placement={placement}
            financialPosition={financialPosition}
            paidAmount={paidAmount}
            onTotalChange={setTotal}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">Total</span>
        <span className="font-semibold text-gray-900">{fmt(total, currency)}</span>
      </div>
    </div>
  );
}
