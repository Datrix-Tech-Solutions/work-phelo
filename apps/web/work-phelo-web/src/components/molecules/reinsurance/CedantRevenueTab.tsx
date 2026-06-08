'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, Currency } from '@/types/reinsurance';

type RevenueRow = Currency & { amount: number | null };

function fmtCurrencyAmount(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildRevenueColumns(amountLabel: string): Column<RevenueRow>[] {
  return [
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
      label: amountLabel,
      width: '220px',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {row.amount != null ? fmtCurrencyAmount(row.amount, row.symbol, row.isoCode) : '—'}
        </span>
      ),
    },
  ];
}

const PREMIUM_COLUMNS = buildRevenueColumns('Total Fac. Premium');
const BROKERAGE_COLUMNS = buildRevenueColumns('Total Brokerage');

interface CedantRevenueTabProps {
  placements: Facultative[];
  currencies: Currency[];
}

export function CedantRevenueTab({ placements, currencies }: CedantRevenueTabProps) {
  const premiumByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of placements) {
      if (p.premium == null || p.currency == null) continue;
      map.set(p.currency, (map.get(p.currency) ?? 0) + p.premium);
    }
    return map;
  }, [placements]);

  const brokerageByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of placements) {
      if (p.premium == null || p.currency == null) continue;
      for (const pt of p.participants) {
        if (pt.status !== 'ACCEPTED' && pt.status !== 'CLOSED') continue;
        const share = pt.sharePercent != null ? parseFloat(pt.sharePercent) : null;
        const fee = pt.brokerageFee != null ? parseFloat(pt.brokerageFee) : null;
        if (share == null || fee == null) continue;
        map.set(p.currency, (map.get(p.currency) ?? 0) + p.premium * (share / 100) * (fee / 100));
      }
    }
    return map;
  }, [placements]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Facultative Premium</h3>
        <DataTable
          columns={PREMIUM_COLUMNS}
          data={currencies.map((c) => ({ ...c, amount: premiumByCode.get(c.isoCode) ?? null }))}
          emptyMessage="No currencies configured"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Brokerage</h3>
        <DataTable
          columns={BROKERAGE_COLUMNS}
          data={currencies.map((c) => ({ ...c, amount: brokerageByCode.get(c.isoCode) ?? null }))}
          emptyMessage="No currencies configured"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      </div>
    </div>
  );
}
