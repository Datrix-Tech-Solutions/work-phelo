'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, Currency } from '@/types/reinsurance';
import { useReinsurerPaymentSummary } from '@/hooks';

type RevenueRow = Currency & {
  brokerage: number | null;
  paidPremiums: number | null;
  outstandingPremiums: number | null;
};

function fmt(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AmountCell({ amount, currency }: { amount: number | null; currency: Currency }) {
  if (amount == null) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-medium text-gray-900">
      {fmt(amount, currency.symbol, currency.isoCode)}
    </span>
  );
}

function OutstandingCell({ amount, currency }: { amount: number | null; currency: Currency }) {
  if (amount == null) return <span className="text-gray-400">—</span>;
  return (
    <span className={`font-medium ${amount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
      {fmt(amount, currency.symbol, currency.isoCode)}
    </span>
  );
}

const REVENUE_COLUMNS: Column<RevenueRow>[] = [
  {
    key: 'currency',
    label: 'Currency',
    width: '1fr',
    render: (row) => (
      <span>
        <span className="font-medium text-gray-900">{row.isoCode}</span>
        <span className="ml-2 text-xs text-gray-400">{row.name}</span>
      </span>
    ),
  },
  {
    key: 'brokerage',
    label: 'Brokerage',
    width: '180px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.brokerage} currency={row} />,
  },
  {
    key: 'paidPremiums',
    label: 'Paid Premiums',
    width: '180px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.paidPremiums} currency={row} />,
  },
  {
    key: 'outstandingPremiums',
    label: 'Outstanding Premiums',
    width: '200px',
    className: 'text-right',
    render: (row) => <OutstandingCell amount={row.outstandingPremiums} currency={row} />,
  },
];

interface ReinsurerRevenueTabProps {
  placements: Facultative[];
  reinsurerId: string;
  reinsurerDefaultBrokerageFee: number | null;
  currencies: Currency[];
}

export function ReinsurerRevenueTab({
  placements,
  reinsurerId,
  reinsurerDefaultBrokerageFee,
  currencies,
}: ReinsurerRevenueTabProps) {
  const { paidByCode } = useReinsurerPaymentSummary(placements, reinsurerId);

  const { brokerageByCode, grossByCode } = useMemo(() => {
    const brokerage = new Map<string, number>();
    const gross = new Map<string, number>();

    for (const placement of placements) {
      const participant = placement.participants.find((pt) => pt.counterpartyId === reinsurerId);
      if (!participant) continue;
      if (participant.status !== 'ACCEPTED' && participant.status !== 'CLOSED') continue;
      if (placement.premium == null || placement.currency == null) continue;

      const share = participant.sharePercent != null ? parseFloat(participant.sharePercent) : null;
      if (share == null) continue;

      const shareAmount = placement.premium * (share / 100);
      gross.set(placement.currency, (gross.get(placement.currency) ?? 0) + shareAmount);

      const feeRaw =
        participant.brokerageFee ??
        (reinsurerDefaultBrokerageFee != null ? String(reinsurerDefaultBrokerageFee) : null);
      const fee = feeRaw != null ? parseFloat(feeRaw) : null;
      if (fee != null) {
        const brokerageAmount = shareAmount * (fee / 100);
        brokerage.set(
          placement.currency,
          (brokerage.get(placement.currency) ?? 0) + brokerageAmount,
        );
      }
    }

    return { brokerageByCode: brokerage, grossByCode: gross };
  }, [placements, reinsurerId, reinsurerDefaultBrokerageFee]);

  const rows: RevenueRow[] = currencies.map((c) => {
    const gross = grossByCode.get(c.isoCode) ?? null;
    const paid = paidByCode.get(c.isoCode) ?? null;
    const outstanding = gross != null ? gross - (paid ?? 0) : null;

    return {
      ...c,
      brokerage: brokerageByCode.get(c.isoCode) ?? null,
      paidPremiums: paid,
      outstandingPremiums: outstanding,
    };
  });

  return (
    <DataTable
      columns={REVENUE_COLUMNS}
      data={rows}
      emptyMessage="No currencies configured"
      currentPage={1}
      totalPages={0}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
