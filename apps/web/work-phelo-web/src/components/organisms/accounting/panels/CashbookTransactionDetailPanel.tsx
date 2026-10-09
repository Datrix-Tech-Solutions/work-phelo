'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { EditCashbookDraftModal } from '@/components/organisms/accounting/panels/EditCashbookDraftModal';
import { RejectDraftModal } from '@/components/organisms/accounting/panels/RejectDraftModal';
import { DraftChoiceModal } from '@/components/organisms/accounting/panels/DraftChoiceModal';
import { NewTransactionPanel } from '@/components/organisms/accounting/panels/NewTransactionPanel';
import { NewTransferPanel } from '@/components/organisms/accounting/panels/NewTransferPanel';
import {
  useDeleteCashbookDraft,
  usePostCashbookTransaction,
  useRejectCashbookTransaction,
  useTransactionTypes,
} from '@/hooks';
import { transactionTypeCodeFromNumber } from '@/lib/accounting/transactionTypeCode';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { CashbookTransaction, CashbookTransactionStatus } from '@/types/accounting';

const STATUS_LABEL: Record<CashbookTransactionStatus, string> = {
  DRAFT: 'PENDING',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED',
};

const STATUS_VARIANT: Record<CashbookTransactionStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
  REJECTED: 'danger',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// Committing a direct entry reads as Receive Payment/Make Payment (money in/out) — same
// wording as everywhere else this action appears — "Post" is only kept for a Transfer.
function actionLabel(direction: CashbookTransaction['direction']) {
  if (direction === 'INFLOW') return 'Receive Payment';
  if (direction === 'OUTFLOW') return 'Make Payment';
  return 'Post';
}

/** A plain cashbook Receipt/Payment/Charge/Adjustment/Transfer — direct-to-ledger, no AP/AR
 *  document behind it, so there's no separate "make payment" step against something else:
 *  committing it IS the settlement. Only a DRAFT one has anything left to do. */
export function CashbookTransactionDetailPanel({
  transaction,
  onClose,
}: {
  transaction: CashbookTransaction | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const postTransaction = usePostCashbookTransaction();
  const rejectTransaction = useRejectCashbookTransaction();
  const deleteDraft = useDeleteCashbookDraft();
  const { data: transactionTypes = [] } = useTransactionTypes();
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  // The draft being redone: its form opens once this panel closes.
  const [redoTarget, setRedoTarget] = useState<CashbookTransaction | null>(null);

  // A draft entered on the Transactions page (not raised by another module) can be redone or
  // deleted. Receipts and payments redo in the form of the type they were made under, which is
  // read back from their number; a transfer has its own form.
  const isOwnDraft =
    !!transaction &&
    transaction.status === 'DRAFT' &&
    !transaction.sourceModule &&
    ['RECEIPT', 'PAYMENT', 'TRANSFER'].includes(transaction.transactionType);
  const typeCode = transactionTypeCodeFromNumber(transaction?.transactionNumber ?? null);
  const redoType = (tx: CashbookTransaction | null) => {
    const code = transactionTypeCodeFromNumber(tx?.transactionNumber ?? null);
    return code ? transactionTypes.find((t) => t.postsToCashbook && t.code === code) : undefined;
  };
  const canRedo =
    transaction?.transactionType === 'TRANSFER' || (!!typeCode && !!redoType(transaction));

  // A direct receipt or payment can be completed or turned down. Customer receipts and vendor
  // payments (sourceModule ACCOUNTING) are handled through their own documents instead.
  const canReviewDraft =
    !!transaction &&
    transaction.status === 'DRAFT' &&
    !isOwnDraft &&
    (transaction.transactionType === 'RECEIPT' || transaction.transactionType === 'PAYMENT') &&
    transaction.sourceModule !== 'ACCOUNTING';
  // Raised by another module (not entered by an accountant): it is simply posted - there is no
  // separate receive/make payment step.
  const isExternal = !!transaction?.sourceModule && transaction.sourceModule !== 'ACCOUNTING';
  const sourceLabel = transaction?.sourceModule
    ? (SOURCE_MODULE_LABELS[transaction.sourceModule as keyof typeof SOURCE_MODULE_LABELS] ??
      transaction.sourceModule)
    : null;

  const handleReject = async (reason: string) => {
    if (!transaction) return;
    try {
      await rejectTransaction.mutateAsync({ transactionId: transaction.id, reason });
      toast.success('Draft rejected.');
      setRejectOpen(false);
      onClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to reject the draft'));
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    try {
      await deleteDraft.mutateAsync(transaction.id);
      toast.success('Draft deleted.');
      setChoiceOpen(false);
      onClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to delete the draft'));
    }
  };

  const handlePost = async () => {
    if (!transaction) return;
    try {
      await postTransaction.mutateAsync(transaction.id);
      toast.success(
        isExternal
          ? 'Transaction posted.'
          : transaction.direction === 'INFLOW'
            ? 'Payment received.'
            : transaction.direction === 'OUTFLOW'
              ? 'Payment made.'
              : 'Transaction posted.',
      );
      onClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to save transaction'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!transaction}
        onClose={onClose}
        title={transaction?.description ?? 'Transaction'}
        description={transaction ? (transaction.reference ?? undefined) : undefined}
        footer={
          transaction &&
          transaction.status === 'DRAFT' && (
            <Button
              className="w-full"
              onClick={handlePost}
              isLoading={postTransaction.isPending}
              loadingText={
                isExternal
                  ? 'Posting…'
                  : transaction.direction === 'INFLOW'
                    ? 'Receiving…'
                    : 'Paying…'
              }
            >
              {isExternal ? 'Post' : actionLabel(transaction.direction)}
            </Button>
          )
        }
      >
        {transaction && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <Badge
              label={STATUS_LABEL[transaction.status]}
              variant={STATUS_VARIANT[transaction.status]}
            />
            {isOwnDraft && (
              <Button size="sm" variant="danger" onClick={() => setChoiceOpen(true)}>
                Reject
              </Button>
            )}
            {canReviewDraft && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}

        {transaction && sourceLabel && transaction.status === 'DRAFT' && (
          <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            Raised from {sourceLabel}. Complete the remaining details, then post it — or reject it
            with a reason.
          </div>
        )}

        {transaction && transaction.status === 'REJECTED' && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">
              Rejected{transaction.rejectedAt ? ` on ${fmtDate(transaction.rejectedAt)}` : ''}
            </p>
            {transaction.rejectionReason && <p className="mt-1">{transaction.rejectionReason}</p>}
          </div>
        )}

        {transaction && (
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <Row label="Type" value={transaction.transactionType} />
            <Row label="Cash/Bank Account" value={transaction.cashAccount.name} />
            {(transaction.lines?.length ?? 0) > 1 ? (
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Lines
                </span>
                {transaction.lines.map((line) => (
                  <div key={line.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-gray-700">
                      {line.glAccount.code} — {line.glAccount.name}
                      {line.kind !== 'ITEM' && (
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {line.kind === 'DEDUCTION' ? 'Deduction' : 'Charge'}
                        </span>
                      )}
                      {line.description && (
                        <span className="block text-xs text-gray-500">{line.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-gray-900">
                      {line.kind === 'DEDUCTION' ? '− ' : line.kind === 'CHARGE' ? '+ ' : ''}
                      {fmtAmount(line.amount, transaction.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              transaction.offsetGlAccount && (
                <Row
                  label="Offset Account"
                  value={`${transaction.offsetGlAccount.code} — ${transaction.offsetGlAccount.name}`}
                />
              )
            )}
            <Row label="Transaction Date" value={fmtDate(transaction.transactionDate)} />
            {transaction.postedJournalEntry && (
              <Row label="Journal #" value={transaction.postedJournalEntry.journalNumber} />
            )}
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {transaction.lines?.some((line) => line.kind !== 'ITEM')
                  ? transaction.direction === 'INFLOW'
                    ? 'Cash received'
                    : 'Cash paid'
                  : 'Amount'}
              </span>
              <span className="font-semibold text-gray-900">
                {fmtAmount(transaction.amount, transaction.currency)}
              </span>
            </div>
          </div>
        )}

        {editOpen && transaction && (
          <EditCashbookDraftModal
            transaction={transaction}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false);
              // The panel shows a snapshot of the row; reopening it shows the saved values.
              onClose();
            }}
          />
        )}

        <DraftChoiceModal
          isOpen={choiceOpen}
          subject={transaction?.transactionNumber ?? 'This entry'}
          canRedo={canRedo}
          isDeleting={deleteDraft.isPending}
          onRedo={() => {
            setRedoTarget(transaction);
            onClose();
          }}
          onDelete={handleDelete}
          onClose={() => setChoiceOpen(false)}
        />

        <RejectDraftModal
          isOpen={rejectOpen}
          subject={transaction?.transactionNumber ?? 'This entry'}
          isRejecting={rejectTransaction.isPending}
          onConfirm={handleReject}
          onClose={() => setRejectOpen(false)}
        />
      </SidePanel>

      <NewTransactionPanel
        transactionType={
          redoTarget && redoTarget.transactionType !== 'TRANSFER'
            ? (redoType(redoTarget) ?? undefined)
            : undefined
        }
        draft={redoTarget ? { kind: 'cashbook', transaction: redoTarget } : null}
        onClose={() => setRedoTarget(null)}
      />
      <NewTransferPanel
        isOpen={redoTarget?.transactionType === 'TRANSFER'}
        draft={redoTarget}
        onClose={() => setRedoTarget(null)}
      />
    </>
  );
}
