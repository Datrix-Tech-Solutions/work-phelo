'use client';

import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Currency } from '@/types/reinsurance';
import { cardClass } from '@/lib/utils';

type AmountRow = Currency & { amount: number | null };

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function buildColumns(label: string): Column<AmountRow>[] {
  return [
    {
      key: 'currency',
      label: 'Currency',
      width: '1fr',
      render: (row) => <span className="font-medium text-gray-900">{row.isoCode}</span>,
    },
    {
      key: 'amount',
      label,
      width: '140px',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {row.amount != null ? fmtAmount(row.amount) : '—'}
        </span>
      ),
    },
  ];
}

interface CurrencyAmountListCardProps {
  title: string;
  columnLabel: string;
  amountsByCode: Map<string, number>;
  currencies: Currency[];
  isLoading?: boolean;
}

export function CurrencyAmountListCard({
  title,
  columnLabel,
  amountsByCode,
  currencies,
  isLoading,
}: CurrencyAmountListCardProps) {
  const rows = currencies
    .map((c) => ({ ...c, amount: amountsByCode.get(c.isoCode) ?? null }))
    .filter((row) => row.amount != null);

  return (
    <div className={cardClass('flex flex-col gap-3 p-5 h-80', 'glass')}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DataList
          columns={buildColumns(columnLabel)}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No data for this period"
          bare
        />
      </div>
    </div>
  );
}
