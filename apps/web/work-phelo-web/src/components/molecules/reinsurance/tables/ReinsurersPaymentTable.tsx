'use client';

import { useEffect, useMemo } from 'react';
import { PlacementParticipant } from '@/types/reinsurance';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useCedants } from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';

interface ReinsurersPaymentTableProps {
  participants: PlacementParticipant[];
  grossPremium: number;
  commission: number;
  currency: string | null;
  cedantId: string;
  paidAmount?: number;
  onTotalChange?: (total: number) => void;
}

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function participantNetPremium(
  p: PlacementParticipant,
  grossPremium: number,
  commission: number,
  deductionRate: number,
) {
  const share = parseFloat(p.sharePercent ?? '0') / 100;
  const brokerage = parseFloat(p.brokerageFee ?? '0');
  const yourPremium = share * grossPremium;
  const netPremium = yourPremium * (1 - (commission + brokerage) / 100);
  return netPremium * (1 - deductionRate);
}

export function ReinsurersPaymentTable({
  participants,
  grossPremium,
  commission,
  currency,
  cedantId,
  // paidAmount = 0,

  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const { data: cedants = [] } = useCedants();
  const deductionRate = isForeignCedant(cedants.find((c) => c.id === cedantId))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;

  const participants_ = useMemo(
    () =>
      participants.filter(
        (p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'),
      ),
    [participants],
  );

  const total = useMemo(
    () =>
      participants_.reduce(
        (sum, p) => sum + participantNetPremium(p, grossPremium, commission, deductionRate),
        0,
      ),
    [participants_, grossPremium, commission, deductionRate],
  );

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  // const proRataFactor = total > 0 ? Math.min(paidAmount / total, 1) : 0;

  const columns: Column<PlacementParticipant>[] = useMemo(
    () => [
      {
        key: 'counterparty',
        label: 'Reinsurer',
        render: (row) => <span className="font-medium text-gray-900">{row.counterparty.name}</span>,
      },
      {
        key: 'sharePercent',
        label: 'Share %',
        width: '80px',
        className: 'text-center',
        render: (row) => (
          <span className="text-gray-600 block text-center">{row.sharePercent ?? '—'}</span>
        ),
      },
      {
        key: 'premiumShare',
        label: 'Premium Share',
        width: '160px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(participantNetPremium(row, grossPremium, commission, deductionRate), currency)}
          </span>
        ),
      },
      // {
      //   key: 'allocated',
      //   label: 'Allocated',
      //   width: '160px',
      //   className: 'text-right',
      //   render: (row) => {
      //     const allocated = participantNetPremium(row, grossPremium, commission) * proRataFactor;
      //     return (
      //       <span className="text-orange-600 font-medium block text-right">
      //         {fmt(allocated, currency)}
      //       </span>
      //     );
      //   },
      // },
    ],
    [grossPremium, commission, currency, deductionRate], //proRataFactor],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pt-4 pb-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <span className="text-sm font-bold text-gray-900">Participants</span>
      </div>

      <DataTable
        columns={columns}
        data={participants_}
        emptyMessage="No participants"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
