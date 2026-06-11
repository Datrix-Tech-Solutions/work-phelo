'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { usePlacementPayments, useReversePlacementPayment } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { PlacementPayment } from '@/types/reinsurance';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: string, currency: string): string {
  const parsed = parseFloat(val) || 0;
  return `${currency} ${parsed.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function label(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

const COLUMNS: Column<PlacementPayment>[] = [
  {
    key: 'paymentDate',
    label: 'Date',
    width: '130px',
    render: (row) => <span className="text-gray-700">{fmtDate(row.paymentDate)}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{label(row.type)}</span>,
  },
  {
    key: 'direction',
    label: 'Direction',
    width: '110px',
    render: (row) => (
      <Badge
        label={label(row.direction)}
        variant={row.direction === 'INBOUND' ? 'success' : 'warning'}
      />
    ),
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
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => (
      <Badge
        label={label(row.status)}
        variant={row.status === 'RECORDED' ? 'success' : 'neutral'}
      />
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    width: '130px',
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
];

interface PaymentHistoryTabProps {
  placementId: string;
}

export function PaymentHistoryTab({ placementId }: PaymentHistoryTabProps) {
  const { data: payments = [], isLoading, isError } = usePlacementPayments(placementId);
  const { mutateAsync: reversePayment } = useReversePlacementPayment(placementId);
  const toast = useToastStore.getState;

  const handleReverse = async (paymentId: string) => {
    try {
      await reversePayment(paymentId);
      toast().addToast({ message: 'Payment reversed successfully', type: 'success' });
    } catch (error) {
      toast().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <DataTable
      columns={COLUMNS}
      data={payments}
      isLoading={isLoading}
      emptyMessage={isError ? 'Unable to load payments' : 'No payments recorded yet'}
      rowActions={(row) =>
        row.status === 'RECORDED'
          ? [{ label: 'Reverse Payment', danger: true, onClick: () => void handleReverse(row.id) }]
          : []
      }
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
