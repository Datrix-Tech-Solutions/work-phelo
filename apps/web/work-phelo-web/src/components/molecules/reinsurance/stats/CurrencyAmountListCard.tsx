'use client';

import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Currency } from '@/types/reinsurance';
import { cn, transparentCardClass } from '@/lib/utils';

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
      width: '56px',
      render: (row) => <span className="font-medium text-gray-900">{row.isoCode}</span>,
    },
    {
      key: 'amount',
      label,
      width: '1fr',
      className: 'text-right',
      render: (row) => (
        <span className="block truncate font-medium text-gray-900">
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
  emptyMessage?: string;
  /** Overrides the card's default height (`h-80`). */
  className?: string;
}

export function CurrencyAmountListCard({
  title,
  columnLabel,
  amountsByCode,
  currencies,
  isLoading,
  emptyMessage = 'No data for this period',
  className,
}: CurrencyAmountListCardProps) {
  const rows = currencies
    .map((c) => ({ ...c, amount: amountsByCode.get(c.isoCode) ?? null }))
    .filter((row) => row.amount != null);

  return (
    <div className={cn(transparentCardClass('flex flex-col gap-3 py-5 h-80'), className)}>
      <h3 className="text-sm font-semibold text-blue-900">{title}</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList
          columns={buildColumns(columnLabel)}
          data={rows}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
