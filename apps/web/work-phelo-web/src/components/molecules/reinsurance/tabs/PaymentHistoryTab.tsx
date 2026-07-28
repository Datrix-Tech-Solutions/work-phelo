'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { usePlacementPayments, useReversePayment } from '@/hooks';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';
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
  placement: Facultative;
}

export function PaymentHistoryTab({ placementId, placement }: PaymentHistoryTabProps) {
  const { data: payments = [], isLoading } = usePlacementPayments(placementId);
  const reversePayment = useReversePayment();
  const addToast = useToastStore((s) => s.addToast);
  const [receiptTarget, setReceiptTarget] = useState<PlacementPayment | null>(null);

  const handleReverse = async (payment: PlacementPayment) => {
    if (!window.confirm('Reverse this payment? The original transaction will remain in history.')) {
      return;
    }
    try {
      await reversePayment.mutateAsync({ placementId, paymentId: payment.id });
      addToast({ message: 'Payment reversed successfully', type: 'success' });
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
      key: 'closing',
      label: 'Closing',
      width: '1.3fr',
      render: (row) => {
        const label = row.endorsementClosing
          ? `Endorsement · ${row.endorsementClosing.closingNumber}`
          : row.closing
            ? `Original · ${row.closing.closingNumber}`
            : 'Placement-level';
        return <span className="text-gray-700">{label}</span>;
      },
    },
    {
      key: 'notes',
      label: 'Payment Details',
      width: '1.4fr',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-gray-700">{row.notes || '—'}</span>
          {row.reference && <span className="text-xs text-gray-400">{row.reference}</span>}
        </div>
      ),
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
    <>
      <DataTable
        columns={COLUMNS}
        data={payments}
        isLoading={isLoading}
        emptyMessage="No payments recorded yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        rowActions={(row: PlacementPayment) => {
          const actions: RowAction[] = [{ label: 'Receipt', onClick: () => setReceiptTarget(row) }];
          if (row.status === 'RECORDED' && !row.reversalOfPaymentId) {
            actions.push({ label: 'Reverse', danger: true, onClick: () => handleReverse(row) });
          }
          return actions;
        }}
      />

      {receiptTarget && (
        <PaymentReceiptModal
          isOpen
          placement={placement}
          payment={receiptTarget}
          onPrint={() => {}}
          onClose={() => setReceiptTarget(null)}
        />
      )}
    </>
  );
}
