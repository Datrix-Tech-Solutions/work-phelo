'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
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

const STATUS_LABEL: Record<string, string> = {
  RECORDED: 'Recorded',
  BANK_CONFIRMED: 'Bank Confirmed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
};

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'neutral'> = {
  RECORDED: 'success',
  BANK_CONFIRMED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
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
    if (
      !window.confirm(
        'Reverse this recorded transaction? The original payment will remain in history, be marked reversed, and a reversal entry will be created.',
      )
    ) {
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
      width: '100px',
      render: (row) => <span className="text-gray-700">{fmtDate(row.paymentDate)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      width: '150px',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-gray-700">{fmtType(row.type)}</span>
          <span className="text-xs text-gray-400">
            {row.direction === 'INBOUND' ? 'Inflow' : 'Outflow'}
          </span>
        </div>
      ),
    },
    {
      key: 'counterparty',
      label: 'Participant',
      width: 'minmax(100px, 0.7fr)',
      render: (row) => <span className="text-gray-700">{row.counterparty.name}</span>,
    },
    // {
    //   key: 'closing',
    //   label: 'Closing',
    //   width: '120px',
    //   render: (row) => {
    //     const label = row.endorsementClosing
    //       ? `Endorsement · ${row.endorsementClosing.closingNumber}`
    //       : row.closing
    //         ? `Original · ${row.closing.closingNumber}`
    //         : 'Placement-level';
    //     return <span className="text-gray-700">{label}</span>;
    //   },
    // },
    {
      key: 'notes',
      label: 'Payment Details',
      width: 'minmax(120px, 1fr)',
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
      width: '120px',
      render: (row) => (
        <span className="font-medium text-gray-900">{fmtAmount(row.amount, row.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (row) => (
        <Badge
          label={STATUS_LABEL[row.status] ?? fmtType(row.status)}
          variant={STATUS_VARIANT[row.status] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '150px',
      className: 'pr-6',
      render: (row) => (
        <div className="flex items-center gap-2">
          <TableButton variant="blue" onClick={() => setReceiptTarget(row)}>
            Reciept
          </TableButton>
          {canReversePayment(row) && (
            <TableButton variant="red" onClick={() => handleReverse(row)}>
              Reverse
            </TableButton>
          )}
        </div>
      ),
    },
  ];

  const canReversePayment = (payment: PlacementPayment) => {
    if (payment.reversalOfPaymentId) return false;
    if (payment.type === 'REINSURER_DISBURSEMENT') {
      return payment.status === 'BANK_CONFIRMED';
    }
    return payment.status === 'RECORDED';
  };

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
