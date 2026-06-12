'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlacementParticipant } from '@/types/reinsurance';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';

interface ReinsurersPaymentTableProps {
  participants: PlacementParticipant[];
  grossPremium: number;
  commission: number;
  currency: string | null;
  onTotalChange?: (total: number) => void;
}

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function participantNetPremium(p: PlacementParticipant, grossPremium: number, commission: number) {
  const share = parseFloat(p.sharePercent ?? '0') / 100;
  const brokerage = parseFloat(p.brokerageFee ?? '0');
  const yourPremium = share * grossPremium;
  return yourPremium * (1 - (commission + brokerage) / 100);
}

export function ReinsurersPaymentTable({
  participants,
  grossPremium,
  commission,
  currency,
  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const reinsurers = useMemo(
    () => participants.filter((p) => p.role !== 'BROKER' && p.status === 'ACCEPTED'),
    [participants],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => reinsurers.map((p) => p.id));

  const options = useMemo(
    () =>
      reinsurers.map((p) => ({
        value: p.id,
        label: p.counterparty.name,
        sublabel: p.sharePercent ? `${p.sharePercent}% share` : undefined,
      })),
    [reinsurers],
  );

  const selected = reinsurers.filter((p) => selectedIds.includes(p.id));

  const total = useMemo(
    () => selected.reduce((sum, p) => sum + participantNetPremium(p, grossPremium, commission), 0),
    [selected, grossPremium, commission],
  );

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

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
        width: '200px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(participantNetPremium(row, grossPremium, commission), currency)}
          </span>
        ),
      },
    ],
    [grossPremium, commission, currency],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="p-4 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <MultiSelect
          label="Reinsurers"
          placeholder="Select reinsurers…"
          options={options}
          value={selectedIds}
          onChange={setSelectedIds}
        />
      </div>

      <DataTable
        columns={columns}
        data={selected}
        emptyMessage="No reinsurers selected"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
