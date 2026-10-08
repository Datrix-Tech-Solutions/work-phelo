'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { TableButton } from '@/components/atoms/TableButton';
import { formatDateRange } from '@/lib/formatters';
import { formatMoney } from '@/lib/formatMoney';
import type { SalesTarget } from '@/types/marketing';

function progressColor(percent: number): string {
  if (percent >= 100) return 'bg-green-500';
  if (percent >= 50) return 'bg-brand';
  return 'bg-amber-500';
}

function amountWithCurrency(amount: string | null, currency: string | null): string {
  if (amount === null) return '—';
  return `${currency ? `${currency} ` : ''}${formatMoney(amount)}`;
}

const COLUMNS: Column<SalesTarget>[] = [
  {
    key: 'rep',
    label: 'Sales Rep',
    width: 'minmax(140px, 1fr)',
    render: (row) => <span className="font-medium text-gray-900">{row.userName ?? '—'}</span>,
  },
  {
    key: 'product',
    label: 'Product',
    width: 'minmax(120px, 1fr)',
    render: (row) => row.productName ?? (row.productId ? '—' : 'All products'),
  },
  {
    key: 'period',
    label: 'Period',
    width: '170px',
    render: (row) => formatDateRange(row.startDate, row.endDate),
  },
  {
    key: 'target',
    label: 'Target',
    width: '130px',
    render: (row) => amountWithCurrency(row.amount, row.currency),
  },
  {
    key: 'achieved',
    label: 'Achieved',
    width: '130px',
    render: (row) => amountWithCurrency(row.achieved, row.currency),
  },
  {
    key: 'progress',
    label: 'Progress',
    width: 'minmax(160px, 1fr)',
    render: (row) =>
      row.percent === null ? (
        <span className="text-xs text-gray-500">Unavailable</span>
      ) : (
        <ProgressBar value={Math.round(row.percent)} fillClassName={progressColor(row.percent)} />
      ),
  },
];

interface Props {
  data: SalesTarget[];
  isLoading?: boolean;
  searchValue: string;
  onSearch: (q: string) => void;
  extraFilters?: React.ReactNode;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the New Target button (no create permission). */
  onAdd?: () => void;
  /** Omit to hide Edit (no edit permission). */
  onEdit?: (row: SalesTarget) => void;
  /** Omit to hide Remove (no delete permission). */
  onRemove?: (row: SalesTarget) => void;
}

export function SalesTargetsTable({
  data,
  isLoading,
  searchValue,
  onSearch,
  extraFilters,
  currentPage,
  totalPages,
  onPageChange,
  onAdd,
  onEdit,
  onRemove,
}: Props) {
  const columns: Column<SalesTarget>[] =
    onEdit || onRemove
      ? [
          ...COLUMNS,
          {
            key: 'actions',
            label: 'Actions',
            width: '130px',
            render: (row) => (
              <div className="flex gap-2">
                {onEdit && (
                  <TableButton variant="blue" onClick={() => onEdit(row)}>
                    Edit
                  </TableButton>
                )}
                {onRemove && (
                  <TableButton variant="red" onClick={() => onRemove(row)}>
                    Remove
                  </TableButton>
                )}
              </div>
            ),
          },
        ]
      : COLUMNS;

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="No targets yet"
      searchPlaceholder="Search by rep or product..."
      searchValue={searchValue}
      onSearch={onSearch}
      extraFilters={extraFilters}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      actionButton={onAdd ? { label: 'New Target', onClick: onAdd } : undefined}
      noInternalScroll
    />
  );
}
