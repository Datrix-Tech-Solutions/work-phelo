'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Period } from '@/components/atoms/PeriodToggle';
import { Currency } from '@/types/reinsurance';
import { useFacultatives, useCurrencies } from '@/hooks';
import { transparentCardClass } from '@/lib/utils';

type AmountRow = Currency & { amount: number | null };

function fmtAmount(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BROKERAGE_COLUMNS: Column<AmountRow>[] = [
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
    width: '140px',
    className: 'text-right',
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.amount != null ? fmtAmount(row.amount, row.symbol, row.isoCode) : '—'}
      </span>
    ),
  },
];

function periodStart(period: Period, now: Date): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;
  switch (period) {
    case 'daily':
      return new Date(y, m, d);
    case 'weekly':
      return new Date(y, m, d - mondayOffset);
    case 'monthly':
      return new Date(y, m, 1);
    case 'yearly':
      return new Date(y, 0, 1);
  }
}

interface BrokerageByCurrencyCardProps {
  period: Period;
}

export function BrokerageByCurrencyCard({ period }: BrokerageByCurrencyCardProps) {
  const { data: all = [] } = useFacultatives();
  const { data: currencies = [] } = useCurrencies();

  const brokerageByCode = useMemo(() => {
    const start = periodStart(period, new Date());
    const map = new Map<string, number>();

    for (const f of all) {
      if (f.premium == null || f.currency == null) continue;
      if (new Date(f.createdAt) < start) continue;

      for (const p of f.participants) {
        if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
        const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
        if (share == null || fee == null) continue;
        map.set(f.currency, (map.get(f.currency) ?? 0) + f.premium * (share / 100) * (fee / 100));
      }
    }

    return map;
  }, [all, period]);

  const rows = currencies
    .map((c) => ({ ...c, amount: brokerageByCode.get(c.isoCode) ?? null }))
    .filter((row) => row.amount != null);

  return (
    <div className={transparentCardClass('flex flex-col gap-3 py-5 h-80')}>
      <h3 className="text-sm font-semibold text-gray-900">Brokerage by Currency</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList columns={BROKERAGE_COLUMNS} data={rows} emptyMessage="No data for this period" />
      </div>
    </div>
  );
}
