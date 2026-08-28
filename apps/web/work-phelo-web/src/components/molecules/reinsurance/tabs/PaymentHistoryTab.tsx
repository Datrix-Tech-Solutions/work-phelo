'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { TableButton } from '@/components/atoms/TableButton';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { usePlacementPayments, useReversePayment } from '@/hooks';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';
import { DisbursementAdviceContent } from '@/components/molecules/documents/content/DisbursementAdviceContent';
import { downloadReceiptsZip } from '@/lib/reinsurance/downloadReceiptsZip';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
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

const BULK_RECEIPT_ROOT_PREFIX = 'bulk-disbursement-receipt-';

function receiptFileName(payment: PlacementPayment): string {
  const party = payment.counterparty.name
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const date = payment.paymentDate.slice(0, 10);
  return `disbursement-advice-${party || 'reinsurer'}-${date}`;
}

const STATUS_LABEL: Record<string, string> = {
  RECORDED: 'Recorded',
  BANK_CONFIRMED: 'Disbursed',
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
  const { data: allPayments = [], isLoading } = usePlacementPayments(placementId);
  // The reversal entry itself (the negative-amount offsetting record) is bookkeeping noise
  // here — the original payment stays visible, marked REVERSED, for audit purposes.
  const payments = allPayments.filter((p) => !p.reversalOfPaymentId);
  const reversePayment = useReversePayment();
  const addToast = useToastStore((s) => s.addToast);
  const [receiptTarget, setReceiptTarget] = useState<PlacementPayment | null>(null);
  const [reverseTarget, setReverseTarget] = useState<PlacementPayment | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  // "Download all receipts" only covers reinsurer disbursements that have been
  // bank-confirmed ("Disbursed").
  const disbursementReceipts = payments.filter(
    (p) => p.type === 'REINSURER_DISBURSEMENT' && p.status === 'BANK_CONFIRMED',
  );

  const isDownloading = downloadProgress !== null;

  const handleDownloadAllReceipts = async () => {
    if (disbursementReceipts.length === 0 || isDownloading) return;
    setDownloadProgress({ done: 0, total: disbursementReceipts.length });
    // Let React mount the hidden print roots before we look them up.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const policyLabel = displayPolicyNumber(placement.policyNumber) || placement.reference;
      await downloadReceiptsZip(
        disbursementReceipts.map((p) => ({
          rootId: `${BULK_RECEIPT_ROOT_PREFIX}${p.id}`,
          fileName: receiptFileName(p),
          title: `Disbursement Advice - ${policyLabel}`,
        })),
        `disbursement-receipts-${policyLabel}`,
        (done, total) => setDownloadProgress({ done, total }),
      );
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    } finally {
      setDownloadProgress(null);
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) return;
    try {
      await reversePayment.mutateAsync({ placementId, paymentId: reverseTarget.id });
      addToast({ message: 'Payment reversed successfully', type: 'success' });
      setReverseTarget(null);
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
          <span className="font-semibold text-gray-700">{fmtType(row.type)}</span>
          {/* <span className="text-xs text-gray-400">
            {row.direction === 'INBOUND' ? 'Inflow' : 'Outflow'}
          </span> */}
        </div>
      ),
    },
    {
      key: 'counterparty',
      label: 'Participant',
      width: 'minmax(100px, 0.7fr)',
      render: (row) => <span className="font-semibold text-gray-700">{row.counterparty.name}</span>,
    },

    {
      key: 'notes',
      label: 'Payment Details',
      width: 'minmax(120px, 1fr)',
      render: (row) => {
        const mainText = [
          row.settlementMethod ? fmtType(row.settlementMethod) : null,
          row.reference,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <div className="flex flex-col">
            <span className="text-gray-700">{mainText || '—'}</span>
            {row.notes && <span className="text-xs text-gray-400">{row.notes}</span>}
          </div>
        );
      },
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
          {row.status !== 'REVERSED' && (
            <TableButton variant="blue" onClick={() => setReceiptTarget(row)}>
              Reciept
            </TableButton>
          )}
          {canReversePayment(row) && (
            <TableButton variant="red" onClick={() => setReverseTarget(row)}>
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
      <div className="mb-3 flex flex-col items-end gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Icons.Download className="h-4 w-4" />}
          onClick={handleDownloadAllReceipts}
          isLoading={isDownloading}
          loadingText={
            downloadProgress
              ? `Preparing ${downloadProgress.done}/${downloadProgress.total}…`
              : 'Preparing…'
          }
          disabled={disbursementReceipts.length === 0}
        >
          Download All Receipts
        </Button>
        {downloadProgress && (
          <div className="w-full sm:w-72">
            <ProgressBar
              value={
                downloadProgress.total > 0
                  ? Math.round((downloadProgress.done / downloadProgress.total) * 100)
                  : 0
              }
            />
          </div>
        )}
      </div>

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
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* Hidden print roots for the bulk "Download all receipts" zip. */}
      {isDownloading &&
        disbursementReceipts.map((p) => (
          <DocumentPrintLayout
            key={p.id}
            rootId={`${BULK_RECEIPT_ROOT_PREFIX}${p.id}`}
            documentTitle="Disbursement Advice"
            afterContent={null}
          >
            <DisbursementAdviceContent placement={placement} payment={p} />
          </DocumentPrintLayout>
        ))}

      <Modal
        isOpen={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        title="Reverse Payment?"
        description="The original payment will remain in history, be marked reversed, and a reversal entry will be created."
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setReverseTarget(null)}
              disabled={reversePayment.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reversePayment.isPending}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse
            </Button>
          </div>
        }
      />
    </>
  );
}
