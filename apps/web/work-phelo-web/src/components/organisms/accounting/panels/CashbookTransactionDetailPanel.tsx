'use client';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { usePostCashbookTransaction } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { CashbookTransaction, CashbookTransactionStatus } from '@/types/accounting';

const STATUS_LABEL: Record<CashbookTransactionStatus, string> = {
  DRAFT: 'PENDING',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
};

const STATUS_VARIANT: Record<CashbookTransactionStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
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

  const handlePost = async () => {
    if (!transaction) return;
    try {
      await postTransaction.mutateAsync(transaction.id);
      toast.success(
        transaction.direction === 'INFLOW'
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
            loadingText={transaction.direction === 'INFLOW' ? 'Receiving…' : 'Paying…'}
          >
            {actionLabel(transaction.direction)}
          </Button>
        )
      }
    >
      {transaction && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status</span>
            <Badge
              label={STATUS_LABEL[transaction.status]}
              variant={STATUS_VARIANT[transaction.status]}
            />
          </div>
          <Row label="Type" value={transaction.transactionType} />
          <Row label="Cash/Bank Account" value={transaction.cashAccount.name} />
          {transaction.offsetGlAccount && (
            <Row
              label="Offset Account"
              value={`${transaction.offsetGlAccount.code} — ${transaction.offsetGlAccount.name}`}
            />
          )}
          <Row label="Transaction Date" value={fmtDate(transaction.transactionDate)} />
          {transaction.postedJournalEntry && (
            <Row label="Journal #" value={transaction.postedJournalEntry.journalNumber} />
          )}
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Amount</span>
            <span className="font-semibold text-gray-900">
              {fmtAmount(transaction.amount, transaction.currency)}
            </span>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
