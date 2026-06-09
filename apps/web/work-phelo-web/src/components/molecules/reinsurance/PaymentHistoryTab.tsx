'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';

interface PaymentRecord {
  id: string;
  date: string;
  paymentType: string;
  bankName: string;
  reference: string;
  currency: string;
  amount: number;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number, currency: string): string {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS: Column<PaymentRecord>[] = [
  {
    key: 'date',
    label: 'Date',
    width: '130px',
    render: (row) => <span className="text-gray-700">{fmtDate(row.date)}</span>,
  },
  {
    key: 'paymentType',
    label: 'Payment Type',
    width: '1fr',
    render: (row) => (
      <span className="text-gray-700 capitalize">{row.paymentType.replace('_', ' ')}</span>
    ),
  },
  {
    key: 'bankName',
    label: 'Bank',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.bankName}</span>,
  },
  {
    key: 'reference',
    label: 'Reference',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{row.reference || '—'}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '1.2fr',
    render: (row) => (
      <span className="font-medium text-gray-900">{fmtAmount(row.amount, row.currency)}</span>
    ),
  },
];

interface PaymentHistoryTabProps {
  placementId: string;
}

export function PaymentHistoryTab({ placementId: _ }: PaymentHistoryTabProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={[]}
      isLoading={false}
      emptyMessage="No payments recorded yet"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
