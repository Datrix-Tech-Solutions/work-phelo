'use client';

import { Badge } from '@/components/atoms/Badge';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { usePlacementPayments, useReversePayment } from '@/hooks';
import { PlacementPayment } from '@/types/reinsurance';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: string, currency: string): string {
  const n = parseFloat(val);
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${n < 0 ? '-' : ''}${abs}`;
}

function fmtType(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'neutral'> = {
  RECORDED: 'success',
  REVERSED: 'danger',
};

interface PaymentHistoryTabProps {
  placementId: string;
}

export function PaymentHistoryTab({ placementId }: PaymentHistoryTabProps) {
  const { data: payments = [], isLoading } = usePlacementPayments(placementId);
  const reversePayment = useReversePayment();
  const addToast = useToastStore((s) => s.addToast);

  const handleReverse = async (payment: PlacementPayment) => {
    try {
      await reversePayment.mutateAsync({ placementId, paymentId: payment.id });
      addToast({ message: 'Payment reversed', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

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
      width: '1.4fr',
      render: (row) => <span className="text-gray-700">{fmtType(row.type)}</span>,
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      width: '1.5fr',
      render: (row) => <span className="text-gray-700">{row.counterparty.name}</span>,
    },
    {
      key: 'reference',
      label: 'Reference',
      width: '1fr',
      render: (row) => <span className="text-gray-500">{row.reference || '—'}</span>,
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
          label={row.status === 'REVERSED' ? 'Reversed' : 'Recorded'}
          variant={STATUS_VARIANT[row.status] ?? 'neutral'}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={COLUMNS}
      data={payments}
      isLoading={isLoading}
      emptyMessage="No payments recorded yet"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
      rowActions={(row) =>
        row.status === 'RECORDED' && !row.reversalOfPaymentId
          ? [{ label: 'Reverse', onClick: () => handleReverse(row) }]
          : []
      }
    />
  );
}
