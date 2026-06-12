'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Facultative, Currency } from '@/types/reinsurance';

type BrokerageRow = Currency & { amount: number | null };

function fmtCurrencyAmount(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BROKERAGE_COLUMNS: Column<BrokerageRow>[] = [
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
    key: 'amount',
    label: 'Total Brokerage',
    width: '200px',
    className: 'text-right',
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.amount != null ? fmtCurrencyAmount(row.amount, row.symbol, row.isoCode) : '—'}
      </span>
    ),
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
  const brokerageByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const placement of placements) {
      const participant = placement.participants.find((pt) => pt.counterpartyId === reinsurerId);
      if (!participant) continue;
      if (participant.status !== 'ACCEPTED' && participant.status !== 'CLOSED') continue;
      if (placement.premium == null || placement.currency == null) continue;

      const share = participant.sharePercent != null ? parseFloat(participant.sharePercent) : null;
      if (share == null) continue;

      const feeRaw =
        participant.brokerageFee ??
        (reinsurerDefaultBrokerageFee != null ? String(reinsurerDefaultBrokerageFee) : null);
      const fee = feeRaw != null ? parseFloat(feeRaw) : null;
      if (fee == null) continue;

      const brokerage = placement.premium * (share / 100) * (fee / 100);
      map.set(placement.currency, (map.get(placement.currency) ?? 0) + brokerage);
    }
    return map;
  }, [placements, reinsurerId, reinsurerDefaultBrokerageFee]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">Brokerage Summary</h3>
      <DataList
        columns={BROKERAGE_COLUMNS}
        data={currencies.map((c) => ({ ...c, amount: brokerageByCode.get(c.isoCode) ?? null }))}
        emptyMessage="No currencies configured"
      />
    </div>
  );
}
