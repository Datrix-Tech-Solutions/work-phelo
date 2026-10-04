'use client';

import { useState } from 'react';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { useClientBillingTransactions } from '@/hooks/marketing/useClients';
import { apiErrorMessage } from '@/lib/apiError';
import { formatMoney } from '@/lib/formatMoney';
import type { BillingTransaction } from '@/types/marketing';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Accounting owns the states, so unknown ones still show — just in a neutral colour. */
function stateColor(state: string): TypeChipColor {
  switch (state.toUpperCase()) {
    case 'DRAFT':
      return 'amber';
    case 'POSTED':
      return 'green';
    case 'REVERSED':
      return 'gray';
    case 'REJECTED':
      return 'red';
    default:
      return 'blue';
  }
}

const COLUMNS: Column<BillingTransaction>[] = [
  {
    key: 'createdAt',
    label: 'Date',
    width: '120px',
    render: (row) => <span className="font-semibold">{formatDate(row.createdAt)}</span>,
  },
  {
    key: 'transactionTypeName',
    label: 'Transaction',
    width: 'minmax(140px, 1fr)',
    render: (row) => <span className="font-semibold">{row.transactionTypeName}</span>,
  },
  {
    key: 'productName',
    label: 'Product',
    width: 'minmax(120px, 1fr)',
    render: (row) => <span>{row.productName ?? '—'}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '140px',
    render: (row) => (
      <span className="font-semibold">
        {row.currency} {formatMoney(row.amount)}
      </span>
    ),
  },
  {
    key: 'receivedAmount',
    label: 'Received',
    width: '140px',
    render: (row) => (
      <span>
        {row.currency} {formatMoney(row.receivedAmount)}
      </span>
    ),
  },
  {
    key: 'state',
    label: 'Status',
    width: '130px',
    render: (row) => <TypeChip label={row.stateLabel} color={stateColor(row.state)} />,
  },
  {
    key: 'documentNumber',
    label: 'Reference',
    width: '140px',
    render: (row) => <span>{row.documentNumber ?? '—'}</span>,
  },
  {
    key: 'reason',
    label: 'Note',
    width: 'minmax(140px, 1fr)',
    render: (row) => <span className="text-gray-500">{row.reason ?? '—'}</span>,
  },
];

interface Props {
  clientId: string;
  /** Shows the "New Transaction" button. */
  onNew?: () => void;
}

/** A client's transactions, with their state read live from Accounting. */
export function ClientTransactionsTab({ clientId, onNew }: Props) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useClientBillingTransactions(clientId, page);

  if (isError) {
    return (
      <p className="text-sm text-red-500 text-center py-8">
        {apiErrorMessage(error, 'Transactions could not be loaded.')}
      </p>
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      data={data?.items ?? []}
      emptyMessage="No transactions yet"
      isLoading={isLoading}
      currentPage={page}
      totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
      onPageChange={setPage}
      actionButton={onNew ? { label: 'New Transaction', onClick: onNew } : undefined}
      noInternalScroll
    />
  );
}
