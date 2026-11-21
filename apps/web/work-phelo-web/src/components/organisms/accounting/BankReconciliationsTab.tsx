'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useBankReconciliations } from '@/hooks';
import { formatDate } from '@/lib/formatters';
import type { BankReconciliation } from '@/types/accounting';

const money = (value: string, currency: string) =>
  `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  cashAccountId: string;
  /** Where a reconciliation's detail page lives, without the reconciliation id. */
  detailBase: string;
  onReconcile: () => void;
}

/** Every reconciliation saved for one cash account. Opening a row shows what was reconciled. */
export function BankReconciliationsTab({ cashAccountId, detailBase, onReconcile }: Props) {
  const router = useRouter();
  const { data, isLoading } = useBankReconciliations(cashAccountId);

  const columns: Column<BankReconciliation>[] = [
    {
      key: 'period',
      label: 'Period',
      render: (row) =>
        `${formatDate(row.statementStartDate)} – ${formatDate(row.statementEndDate)}`,
    },
    { key: 'statementReference', label: 'Reference' },
    {
      key: 'openingBalance',
      label: 'Opening Balance',
      className: 'text-right',
      render: (row) => money(row.openingBalance, row.currency),
    },
    {
      key: 'closingBalance',
      label: 'Closing Balance',
      className: 'text-right',
      render: (row) => money(row.closingBalance, row.currency),
    },
    {
      key: 'reconciled',
      label: 'Reconciled',
      render: (row) =>
        `${row.matchedLineCount ?? 0} of ${row._count.statementLines} bank · ${row._count.reconciledEntries} system`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          label={row.status === 'COMPLETED' ? 'Reconciled' : row.status}
          variant={row.status === 'COMPLETED' ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: 'completedAt',
      label: 'Completed',
      render: (row) => (row.completedAt ? formatDate(row.completedAt) : '—'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      isLoading={isLoading}
      emptyMessage="No reconciliations yet"
      actionButton={{ label: 'Reconcile', onClick: onReconcile }}
      onRowClick={(row) => router.push(`${detailBase}/${row.id}`)}
      currentPage={1}
      totalPages={1}
      onPageChange={() => undefined}
      noInternalScroll
    />
  );
}
