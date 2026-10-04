'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { ClientPaymentModal } from '@/components/organisms/marketing/ClientPaymentModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { useCancelClientPayment, useClientBillingTransactions } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatMoney } from '@/lib/formatMoney';
import { cn } from '@/lib/utils';
import type { BillingInvoicePayment, BillingTransaction } from '@/types/marketing';

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
    case 'PENDING':
      return 'amber';
    case 'CANCELLED':
      return 'gray';
    case 'REVERSED':
      return 'gray';
    case 'REJECTED':
      return 'red';
    default:
      return 'blue';
  }
}

function paymentDate(value: string): string {
  return formatDate(`${value}T00:00:00`);
}

/** The payments on an invoice, shown under its row. */
function PaymentRows({
  invoice,
  onCancel,
}: {
  invoice: BillingTransaction;
  onCancel?: (payment: BillingInvoicePayment) => void;
}) {
  return (
    <div className="relative mx-6 mb-2 ml-10 rounded-lg border border-gray-100 bg-gray-50/60">
      {(invoice.payments ?? []).map((payment) => (
        <div
          key={`${payment.kind}-${payment.id}`}
          className="grid grid-cols-[110px_minmax(120px,1fr)_130px_110px_minmax(100px,1fr)_minmax(120px,1fr)_90px] items-center gap-x-4 border-b border-gray-100 px-4 py-2 text-sm last:border-b-0"
        >
          <span>{paymentDate(payment.paymentDate)}</span>
          <span className="font-medium text-gray-800">
            {payment.kind === 'PAYMENT_REQUEST' ? 'Payment' : 'Receipt'}
            {payment.requestedByName ? (
              <span className="font-normal text-gray-500"> · {payment.requestedByName}</span>
            ) : null}
          </span>
          <span className="font-semibold">
            {payment.currency} {formatMoney(payment.amount)}
          </span>
          <TypeChip label={payment.stateLabel} color={stateColor(payment.state)} />
          <span className="truncate">{payment.reference ?? '—'}</span>
          <span className="truncate text-gray-500">{payment.reason ?? '—'}</span>
          <span className="flex justify-end">
            {payment.kind === 'PAYMENT_REQUEST' && payment.state === 'PENDING' && onCancel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(payment);
                }}
                className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  clientId: string;
  clientName: string;
  /** Shows the "New Transaction" button. */
  onNew?: () => void;
  /** Lets the user ask Accounting to record a payment, or withdraw a request. */
  canPay?: boolean;
}

/** A client's transactions, with their state read live from Accounting. */
export function ClientTransactionsTab({ clientId, clientName, onNew, canPay }: Props) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<BillingTransaction | null>(null);
  const [cancelling, setCancelling] = useState<BillingInvoicePayment | null>(null);
  const { data, isLoading, isError, error } = useClientBillingTransactions(clientId, page);
  const cancelPayment = useCancelClientPayment(clientId);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const columns: Column<BillingTransaction>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      width: '130px',
      render: (row) => (
        <span className="flex items-center gap-1 font-semibold">
          <ChevronRight
            size={14}
            className={cn(
              'shrink-0 text-gray-400 transition-transform',
              expanded.has(row.id) && 'rotate-90',
              !row.payments?.length && 'invisible',
            )}
          />
          {formatDate(row.createdAt)}
        </span>
      ),
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
      key: 'outstandingAmount',
      label: 'Outstanding',
      width: '150px',
      render: (row) =>
        row.outstandingAmount === undefined ? (
          <span>—</span>
        ) : (
          <span className="flex flex-col leading-tight">
            <span>
              {row.currency} {formatMoney(row.outstandingAmount)}
            </span>
            {Number(row.pendingAmount ?? 0) > 0 && (
              <span className="text-xs font-medium text-amber-600">
                {formatMoney(row.pendingAmount)} pending
              </span>
            )}
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
    {
      key: 'payment',
      label: 'Payment',
      width: '150px',
      render: (row) => {
        if (row.kind !== 'INVOICE' || row.state.toUpperCase() !== 'POSTED') return <span>—</span>;
        if (row.canRequestPayment) {
          return canPay ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setPaying(row);
              }}
            >
              Make Payment
            </Button>
          ) : (
            <span>—</span>
          );
        }
        if (Number(row.pendingAmount ?? 0) > 0) {
          return <span className="text-sm font-medium text-amber-600">Payment pending</span>;
        }
        return <span className="text-sm font-medium text-green-600">Paid</span>;
      },
    },
  ];

  function handleCancel() {
    if (!cancelling) return;
    cancelPayment.mutate(cancelling.id, {
      onSuccess: () => {
        toast.success('Payment request cancelled');
        setCancelling(null);
      },
      onError: (err) => toast.error(apiErrorMessage(err, 'Failed to cancel the payment request')),
    });
  }

  if (isError) {
    return (
      <p className="text-sm text-red-500 text-center py-8">
        {apiErrorMessage(error, 'Transactions could not be loaded.')}
      </p>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        emptyMessage="No transactions yet"
        isLoading={isLoading}
        currentPage={page}
        totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
        onPageChange={setPage}
        actionButton={onNew ? { label: 'New Transaction', onClick: onNew } : undefined}
        onRowClick={(row) => {
          if (row.payments?.length) toggle(row.id);
        }}
        renderExpandedRow={(row) =>
          expanded.has(row.id) && row.payments?.length ? (
            <PaymentRows invoice={row} onCancel={canPay ? setCancelling : undefined} />
          ) : null
        }
        noInternalScroll
      />

      {paying && (
        <ClientPaymentModal
          clientId={clientId}
          clientName={clientName}
          invoice={paying}
          onClose={() => setPaying(null)}
        />
      )}

      <Modal
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel Payment Request"
        description={
          cancelling
            ? `${cancelling.currency} ${formatMoney(cancelling.amount)} will be released and can be requested again.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCancelling(null)}
              disabled={cancelPayment.isPending}
            >
              Keep Request
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              isLoading={cancelPayment.isPending}
              loadingText="Cancelling…"
            >
              Cancel Request
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Accounting will no longer see this request. This cannot be undone once Accounting has
          recorded the payment.
        </p>
      </Modal>
    </>
  );
}
