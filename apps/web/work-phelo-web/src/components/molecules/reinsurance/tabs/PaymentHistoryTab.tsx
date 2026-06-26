'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { usePlacementPayments } from '@/hooks';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';

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
  const [receiptTarget, setReceiptTarget] = useState<PlacementPayment | null>(null);

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
      label: 'Cedant',
      width: '1.5fr',
      render: (row) => <span className="text-gray-700">{row.counterparty.name}</span>,
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
        rowActions={(row: PlacementPayment) => [
          { label: 'Preview Receipt', onClick: () => setReceiptTarget(row) },
        ]}
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
