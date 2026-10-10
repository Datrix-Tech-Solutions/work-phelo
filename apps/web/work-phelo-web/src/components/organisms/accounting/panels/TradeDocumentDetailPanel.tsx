'use client';

import { Fragment, useState, ChangeEvent } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { EditInvoiceDraftModal } from '@/components/organisms/accounting/panels/EditInvoiceDraftModal';
import { RejectDraftModal } from '@/components/organisms/accounting/panels/RejectDraftModal';
import { DraftChoiceModal } from '@/components/organisms/accounting/panels/DraftChoiceModal';
import {
  NewTransactionPanel,
  type EntryChangeMode,
} from '@/components/organisms/accounting/panels/NewTransactionPanel';
import { RestoreEntryModal } from '@/components/organisms/accounting/panels/RestoreEntryModal';
import { VoidEntryModal } from '@/components/organisms/accounting/panels/VoidEntryModal';
import {
  SourceRecordPanel,
  SourceRecordTarget,
} from '@/components/organisms/accounting/panels/SourceRecordPanel';
import { MakePaymentPanel } from '@/components/organisms/accounting/panels/MakePaymentPanel';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import {
  AccountingTradeDocument,
  AccountingTradeDocumentPaymentState,
  AccountingTradeDocumentStatus,
  AccountingTradeSide,
  PaymentRequest,
  PaymentRequestStatus,
} from '@/types/accounting';
import {
  useGLAccounts,
  useInvoicePaymentRequests,
  usePayableBillBalance,
  usePeriodOpenCheck,
  useRestoreTradeEntry,
  useVoidTradeEntry,
  usePostPayableBill,
  usePostPayableCreditNote,
  usePostReceivableCreditNote,
  usePostReceivableInvoice,
  useReceivableInvoiceBalance,
  useRejectPaymentRequest,
  useRejectReceivableInvoice,
  useReversePayableBill,
  useReversePayableCreditNote,
  useReverseReceivableCreditNote,
  useReverseReceivableInvoice,
  useTaxTypes,
  useDeleteTradeDraft,
  useTransactionTypes,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatJournalNumber } from '@/lib/formatters';

interface TradeDocumentDetailPanelProps {
  side: AccountingTradeSide;
  document: AccountingTradeDocument | null;
  onClose: () => void;
  /** 'invoice' (default) covers both AR invoices and AP bills — they share the
   * balance endpoint. Credit notes don't have a balance endpoint, so that fetch
   * and display are skipped for 'creditNote'. */
  documentKind?: 'invoice' | 'creditNote';
  /** Called after "Post and Pay" successfully posts the document — the caller opens
   * its own Make/Receive Payment panel with the now-posted document. */
  onPostedForPayment?: (document: AccountingTradeDocument) => void;
}

const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
  REJECTED: 'danger',
  VOIDED: 'neutral',
};

const REQUEST_STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Received',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const STATUS_LABEL: Record<AccountingTradeDocumentStatus, string> = {
  DRAFT: 'PENDING APPROVAL',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED',
  VOIDED: 'Voided',
};

const PAYMENT_STATE_VARIANT: Record<
  AccountingTradeDocumentPaymentState,
  'success' | 'neutral' | 'danger' | 'warning' | 'info'
> = {
  DRAFT: 'neutral',
  REVERSED: 'danger',
  REJECTED: 'danger',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OPEN: 'info',
};

const PAYMENT_STATE_LABEL: Record<AccountingTradeDocumentPaymentState, string> = {
  DRAFT: 'Draft',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  OPEN: 'Unpaid',
};

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export function TradeDocumentDetailPanel({
  side,
  document,
  onClose,
  documentKind = 'invoice',
  onPostedForPayment,
}: TradeDocumentDetailPanelProps) {
  const toast = useToast();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  // The entry whose form is opening (a draft to redo, a posted one to edit, a voided one to
  // restore): its form opens once this panel closes.
  const [formTarget, setFormTarget] = useState<{
    document: AccountingTradeDocument;
    mode: EntryChangeMode;
  } | null>(null);
  const redoTarget = formTarget?.document ?? null;
  const setRedoTarget = (doc: AccountingTradeDocument | null) =>
    setFormTarget(doc ? { document: doc, mode: 'redo' } : null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [receiveRequest, setReceiveRequest] = useState<PaymentRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<PaymentRequest | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isReceivable = side === 'RECEIVABLE';
  const isCreditNote = documentKind === 'creditNote';
  const partyLabel = isReceivable ? 'Customer' : 'Vendor';
  const settlementLabel = isReceivable ? 'Applied Receipts' : 'Applied Payments';

  const receivableBalance = useReceivableInvoiceBalance(
    isReceivable && !isCreditNote ? document?.id : undefined,
  );
  const payableBalance = usePayableBillBalance(
    !isReceivable && !isCreditNote ? document?.id : undefined,
  );
  const balance = isReceivable ? receivableBalance.data : payableBalance.data;
  // Credit/debit notes applied to this invoice/bill are shown beside its payment state, not
  // folded into it — a credited invoice has not been paid.
  const credited = Number(balance?.appliedCreditNotes ?? 0);
  const creditStatus =
    credited <= 0
      ? null
      : credited >= Number(balance?.originalAmount ?? 0)
        ? 'Fully Credited'
        : 'Partially Credited';

  // Requests from another module to record a client's payment against this invoice.
  const { data: paymentRequests = [] } = useInvoicePaymentRequests(
    isReceivable && !isCreditNote && document?.status === 'POSTED' ? document.id : undefined,
  );
  const rejectPaymentRequest = useRejectPaymentRequest();
  const waitingRequests = paymentRequests.filter((r) => r.status === 'PENDING');
  const pastRequests = paymentRequests.filter((r) => r.status !== 'PENDING');
  const pendingTotal = waitingRequests.reduce((sum, r) => sum + Number(r.amount), 0);

  const postReceivableInvoice = usePostReceivableInvoice();
  const postPayableBill = usePostPayableBill();
  const postReceivableCreditNote = usePostReceivableCreditNote();
  const postPayableCreditNote = usePostPayableCreditNote();
  const reverseReceivableInvoice = useReverseReceivableInvoice();
  const rejectInvoice = useRejectReceivableInvoice();
  const reversePayableBill = useReversePayableBill();
  const reverseReceivableCreditNote = useReverseReceivableCreditNote();
  const reversePayableCreditNote = useReversePayableCreditNote();

  const postReceivable = isCreditNote ? postReceivableCreditNote : postReceivableInvoice;
  const postPayable = isCreditNote ? postPayableCreditNote : postPayableBill;
  const reverseReceivable = isCreditNote ? reverseReceivableCreditNote : reverseReceivableInvoice;
  const reversePayable = isCreditNote ? reversePayableCreditNote : reversePayableBill;

  const isPosting = isReceivable ? postReceivable.isPending : postPayable.isPending;
  const isReversing = isReceivable ? reverseReceivable.isPending : reversePayable.isPending;

  // A draft customer invoice can be completed or turned down, whoever raised it. Its amount, quantity
  // and unit price are fixed when it is raised.
  // Raised by another module (not entered by an accountant): its payment is received separately,
  // so the "post and receive payment" shortcut doesn't apply.
  const isExternal = !!document?.sourceModule && document.sourceModule !== 'ACCOUNTING';
  const canReviewDraft =
    isReceivable && !isCreditNote && document?.status === 'DRAFT' && isExternal;
  // A draft entered here (not raised by another module) can be redone in its form or deleted.
  const isOwnDraft = document?.status === 'DRAFT' && !isExternal;
  const { data: transactionTypes = [] } = useTransactionTypes();
  const redoType = (doc: AccountingTradeDocument | null) =>
    doc?.transactionTypeId
      ? transactionTypes.find((t) => t.id === doc.transactionTypeId)
      : undefined;
  const deleteReceivableDraft = useDeleteTradeDraft('RECEIVABLE');
  const deletePayableDraft = useDeleteTradeDraft('PAYABLE');
  const deleteDraft = isReceivable ? deleteReceivableDraft : deletePayableDraft;
  // A posted invoice, bill, credit or debit note entered here can be edited or voided while its
  // period is open - once nothing has been paid or credited against it. A voided one can be
  // restored. Another module's documents change in that module.
  // The receipts/payments and credit/debit notes applied to this document, opened in their own
  // panel so they can be voided before the document is. The type is kept after closing so a form
  // they host survives.
  const [appliedTarget, setAppliedTarget] = useState<SourceRecordTarget | null>(null);
  const isPeriodOpen = usePeriodOpenCheck();
  const entrySide = isReceivable ? 'RECEIVABLE' : 'PAYABLE';
  const voidEntry = useVoidTradeEntry(entrySide);
  const restoreEntry = useRestoreTradeEntry(entrySide);
  const periodOpen = isPeriodOpen(document?.documentDate);
  const untouched = isCreditNote || (!!balance && balance.paymentState === 'OPEN' && credited <= 0);
  const canChangePosted = document?.status === 'POSTED' && !isExternal && periodOpen;
  const canVoidPosted = canChangePosted && untouched;
  const canEditPosted = canVoidPosted && !isCreditNote && !!redoType(document ?? null);
  const canRestore = document?.status === 'VOIDED' && !isExternal && periodOpen;
  const restoresInForm = canRestore && !isCreditNote && !!redoType(document ?? null);
  const sourceLabel = document?.sourceModule
    ? (SOURCE_MODULE_LABELS[document.sourceModule as keyof typeof SOURCE_MODULE_LABELS] ??
      document.sourceModule)
    : null;

  const { data: glAccounts = [] } = useGLAccounts();
  const { data: taxTypes = [] } = useTaxTypes();

  // A non-credit-note document (invoice/bill) debits AR / credits AP on its control
  // account; a credit note reverses that — see documentJournalDto on the backend.
  const controlAccountLabel = isReceivable ? 'Receivable (AR) Account' : 'Payable (AP) Account';
  const controlAccountDirection = isReceivable
    ? isCreditNote
      ? 'Credit'
      : 'Debit'
    : isCreditNote
      ? 'Debit'
      : 'Credit';
  const offsetDirection = controlAccountDirection === 'Debit' ? 'Credit' : 'Debit';

  const taxLines = (document?.taxBreakdown ?? []).map((line) => {
    const account = glAccounts.find((a) => a.id === line.glAccountId);
    const taxType = taxTypes.find((t) => t.id === line.taxTypeId);
    return {
      key: line.glAccountId + line.taxTypeId,
      accountLabel: account ? `${account.code} – ${account.name}` : line.glAccountId,
      taxTypeLabel:
        line.kind === 'DEDUCTION' || line.kind === 'CHARGE' ? null : (taxType?.name ?? null),
      kind: line.kind ?? 'TAX',
      note: line.description ?? null,
      direction: line.direction ?? null,
      amount: line.amount,
    };
  });

  const handleClose = () => {
    setReverseOpen(false);
    setReason('');
    onClose();
  };

  const handleVoid = async (voidReason: string) => {
    if (!document) return;
    try {
      await voidEntry.mutateAsync({
        id: document.id,
        kind: isCreditNote ? 'note' : 'document',
        reason: voidReason,
      });
      toast.success(`${document.documentNumber} voided. It is in the archive now.`);
      setVoidOpen(false);
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to void'));
    }
  };

  const handleRestoreAsIs = async () => {
    if (!document) return;
    try {
      await restoreEntry.mutateAsync({
        id: document.id,
        kind: isCreditNote ? 'note' : 'document',
      });
      toast.success(`${document.documentNumber} restored.`);
      setRestoreOpen(false);
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to restore'));
    }
  };

  const handlePost = async () => {
    if (!document) return;
    try {
      if (isReceivable) {
        await postReceivable.mutateAsync(document.id);
      } else {
        await postPayable.mutateAsync(document.id);
      }
      toast.success(isCreditNote ? 'Credit note posted.' : 'Invoice posted.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to post document'));
    }
  };

  const [isPostingForPayment, setIsPostingForPayment] = useState(false);

  const handlePostAndPay = async () => {
    if (!document) return;
    setIsPostingForPayment(true);
    try {
      const posted = isReceivable
        ? await postReceivable.mutateAsync(document.id)
        : await postPayable.mutateAsync(document.id);
      toast.success(isCreditNote ? 'Credit note posted.' : 'Invoice posted.');
      onPostedForPayment?.(posted);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to post document'));
    } finally {
      setIsPostingForPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    try {
      await deleteDraft.mutateAsync({ id: document.id, isCreditNote });
      toast.success('Draft deleted.');
      setChoiceOpen(false);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete the draft'));
    }
  };

  const handleReject = async (rejectReason: string) => {
    if (!document) return;
    try {
      await rejectInvoice.mutateAsync({ id: document.id, reason: rejectReason });
      toast.success('Draft rejected.');
      setRejectOpen(false);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to reject the draft'));
    }
  };

  const handleReverse = async () => {
    if (!document) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      if (isReceivable) {
        await reverseReceivable.mutateAsync({
          id: document.id,
          reversalDate,
          reason: reason.trim(),
        });
      } else {
        await reversePayable.mutateAsync({
          id: document.id,
          reversalDate,
          reason: reason.trim(),
        });
      }
      toast.success('Document reversed.');
      setReverseOpen(false);
      setReason('');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse document'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!document}
        onClose={handleClose}
        title={document?.documentNumber ?? 'Document'}
        description={document?.description ?? undefined}
        footer={
          document?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              {onPostedForPayment && !isExternal && (
                <Button
                  variant="outline"
                  isLoading={isPostingForPayment}
                  loadingText="Posting…"
                  onClick={handlePostAndPay}
                >
                  Post and {isReceivable ? 'Receive Payment' : 'Pay'}
                </Button>
              )}
              <Button isLoading={isPosting} loadingText="Posting…" onClick={handlePost}>
                Post
              </Button>
            </div>
          ) : document?.status === 'POSTED' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="danger" onClick={() => setReverseOpen(true)}>
                Reverse
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )
        }
      >
        {document && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  label={STATUS_LABEL[document.status]}
                  variant={STATUS_VARIANT[document.status]}
                />
                {balance && balance.paymentState !== 'DRAFT' && (
                  <Badge
                    label={PAYMENT_STATE_LABEL[balance.paymentState]}
                    variant={PAYMENT_STATE_VARIANT[balance.paymentState]}
                  />
                )}
                {balance && creditStatus && <Badge label={creditStatus} variant="info" />}
              </div>
              {isOwnDraft && (
                <Button size="sm" variant="danger" onClick={() => setChoiceOpen(true)}>
                  Reject
                </Button>
              )}
              {(canEditPosted || canVoidPosted) && (
                <div className="flex items-center gap-2">
                  {canEditPosted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFormTarget({ document, mode: 'edit' });
                        handleClose();
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {canVoidPosted && (
                    <Button size="sm" variant="danger" onClick={() => setVoidOpen(true)}>
                      Void
                    </Button>
                  )}
                </div>
              )}
              {canRestore && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!restoresInForm) {
                      setRestoreOpen(true);
                      return;
                    }
                    setFormTarget({ document, mode: 'restore' });
                    handleClose();
                  }}
                >
                  Restore
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

            {sourceLabel && document.status === 'DRAFT' && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                Raised from {sourceLabel}. Complete the remaining details, then post it — or reject
                it with a reason.
              </div>
            )}

            {document.status === 'VOIDED' && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold">
                  Voided{document.voidedAt ? ` on ${fmtDate(document.voidedAt)}` : ''}
                </p>
                {document.voidReason && <p className="mt-1">{document.voidReason}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  It counts in no balance or report.
                  {!periodOpen && ' Its period is no longer open, so it can’t be restored.'}
                </p>
              </div>
            )}

            {document.status === 'POSTED' &&
              !isExternal &&
              periodOpen &&
              !untouched &&
              !!balance && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  To edit or void this {isReceivable ? 'invoice' : 'bill'}, first void the{' '}
                  {isReceivable ? 'receipts' : 'payments'} and {isReceivable ? 'credit' : 'debit'}{' '}
                  notes applied to it. Open each from the list below and void it there.
                </div>
              )}

            {document.status === 'REJECTED' && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-semibold">
                  Rejected{document.rejectedAt ? ` on ${fmtDate(document.rejectedAt)}` : ''}
                </p>
                {document.rejectionReason && <p className="mt-1">{document.rejectionReason}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label={partyLabel} value={`${document.party.name} (${document.party.code})`} />
              <Field label="Document Date" value={fmtDate(document.documentDate)} />
              <Field label="Due Date" value={fmtDate(document.dueDate)} />
              <Field
                label="Total Amount"
                value={fmtAmount(document.totalAmount, document.currency)}
              />
              <Field
                label="Subtotal / Tax"
                value={`${fmtAmount(document.subtotalAmount, document.currency)} / ${fmtAmount(document.taxAmount, document.currency)}`}
              />
              {document.costCentre && (
                <Field
                  label="Cost Centre"
                  value={`${document.costCentre.code} – ${document.costCentre.name}`}
                />
              )}
              {document.externalReference && (
                <Field label="External Reference" value={document.externalReference} />
              )}
              {document.originalDocument && (
                <Field label="Applied To" value={document.originalDocument.documentNumber} />
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500">
                Posting ({controlAccountLabel} — {controlAccountDirection})
              </span>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-sm">
                <span className="text-gray-500 text-xs font-medium">Account</span>
                <span className="text-gray-500 text-xs font-medium">Side</span>
                <span className="text-gray-500 text-xs font-medium text-right">Amount</span>

                <span className="text-gray-900">
                  {document.controlAccount.code} – {document.controlAccount.name}
                </span>
                <span className="text-gray-700">{controlAccountDirection}</span>
                <span className="text-right text-gray-900">
                  {fmtAmount(document.totalAmount, document.currency)}
                </span>

                {document.lines.length > 0 ? (
                  document.lines.map((item) => (
                    <Fragment key={item.id}>
                      <span className="text-gray-900">
                        {item.glAccount.code} – {item.glAccount.name}
                        {item.description && (
                          <span className="ml-2 text-xs text-gray-500">{item.description}</span>
                        )}
                        {item.costCentre && (
                          <span className="ml-2 text-xs text-gray-500">
                            · {item.costCentre.code}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-700">{offsetDirection}</span>
                      <span className="text-right text-gray-900">
                        {fmtAmount(item.amount, document.currency)}
                      </span>
                    </Fragment>
                  ))
                ) : (
                  <>
                    <span className="text-gray-900">
                      {document.offsetGlAccount.code} – {document.offsetGlAccount.name}
                    </span>
                    <span className="text-gray-700">{offsetDirection}</span>
                    <span className="text-right text-gray-900">
                      {fmtAmount(document.subtotalAmount, document.currency)}
                    </span>
                  </>
                )}

                {taxLines.map((line) => (
                  <Fragment key={line.key}>
                    <span className="text-gray-900">
                      {line.accountLabel}
                      {line.taxTypeLabel ? ` (${line.taxTypeLabel})` : ''}
                      {line.kind !== 'TAX' && (
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {line.kind === 'DEDUCTION' ? 'Deduction' : 'Charge'}
                          {line.note ? ` · ${line.note}` : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-700">
                      {line.direction
                        ? line.direction === 'DR'
                          ? 'Debit'
                          : 'Credit'
                        : offsetDirection}
                    </span>
                    <span className="text-right text-gray-900">
                      {fmtAmount(line.amount, document.currency)}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>

            {balance && document.status === 'POSTED' && (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500">Balance</span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-600">Original</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.originalAmount, balance.currency)}
                  </span>
                  <span className="text-gray-600">{settlementLabel}</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.appliedSettlements, balance.currency)}
                  </span>
                  <span className="text-gray-600">Applied Credit Notes</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.appliedCreditNotes, balance.currency)}
                  </span>
                  <span className="font-semibold text-gray-900">Outstanding</span>
                  <span className="text-right font-semibold text-gray-900">
                    {fmtAmount(balance.outstandingAmount, balance.currency)}
                  </span>
                  {pendingTotal > 0 && (
                    <>
                      <span className="text-gray-600">Pending requests</span>
                      <span className="text-right text-amber-700">
                        {fmtAmount(String(pendingTotal), balance.currency)}
                      </span>
                      <span className="text-gray-600">Available to claim</span>
                      <span className="text-right text-gray-900">
                        {fmtAmount(
                          String(Math.max(0, Number(balance.outstandingAmount) - pendingTotal)),
                          balance.currency,
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {balance &&
              document.status === 'POSTED' &&
              (balance.appliedSettlementDetails.length > 0 || balance.appliedNotes.length > 0) && (
                <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-500">
                    Applied to this {isReceivable ? 'invoice' : 'bill'}
                  </span>
                  {balance.appliedSettlementDetails.map((item) => (
                    <button
                      key={item.allocationId}
                      type="button"
                      disabled={!item.settlementId}
                      onClick={() =>
                        item.settlementId &&
                        setAppliedTarget({
                          type: isReceivable ? 'RECEIPT' : 'PAYMENT',
                          id: item.settlementId,
                        })
                      }
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-900">
                        {isReceivable ? 'Receipt' : 'Payment'} {item.settlementNumber ?? ''}
                      </span>
                      <span className="text-gray-600">
                        {fmtAmount(item.amount, balance.currency)}
                      </span>
                    </button>
                  ))}
                  {balance.appliedNotes.map((item) => (
                    <button
                      key={item.allocationId}
                      type="button"
                      disabled={!item.creditNoteId}
                      onClick={() =>
                        item.creditNoteId &&
                        setAppliedTarget({
                          type: isReceivable ? 'CREDIT_NOTE' : 'DEBIT_NOTE',
                          id: item.creditNoteId,
                        })
                      }
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-900">
                        {isReceivable ? 'Credit note' : 'Debit note'} {item.documentNumber ?? ''}
                      </span>
                      <span className="text-gray-600">
                        {fmtAmount(item.amount, balance.currency)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

            {paymentRequests.length > 0 && document.status === 'POSTED' && (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-3">
                <span className="text-xs font-semibold text-gray-500">Payment requests</span>
                {waitingRequests.length === 0 && (
                  <p className="text-sm text-gray-500">Nothing is waiting for you.</p>
                )}
                {waitingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-900">
                        {fmtAmount(request.amount, request.currency)}
                      </span>
                      <span className="text-gray-600">{fmtDate(request.paymentDate)}</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Requested by {request.requestedByName ?? 'a user'}
                      {request.reference ? ` · ref. ${request.reference}` : ''}
                    </p>
                    {request.note && <p className="text-xs text-gray-600">“{request.note}”</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="danger" onClick={() => setRejectRequest(request)}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => setReceiveRequest(request)}>
                        Receive Payment
                      </Button>
                    </div>
                  </div>
                ))}
                {pastRequests.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="self-start text-xs font-medium text-brand hover:underline"
                      onClick={() => setHistoryOpen((open) => !open)}
                    >
                      {historyOpen ? 'Hide' : 'Show'} request history ({pastRequests.length})
                    </button>
                    {historyOpen &&
                      pastRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between gap-3 text-sm text-gray-700"
                        >
                          <span>
                            {fmtAmount(request.amount, request.currency)} ·{' '}
                            {fmtDate(request.paymentDate)}
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            {REQUEST_STATUS_LABEL[request.status]}
                            {request.status === 'REJECTED' && request.rejectionReason
                              ? ` — ${request.rejectionReason}`
                              : ''}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {document.postedJournalEntry && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-900">
                Posted as journal {formatJournalNumber(document.postedJournalEntry.journalNumber)}{' '}
                on {fmtDate(document.postedJournalEntry.postedAt)}.
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {editOpen && document && (
        <EditInvoiceDraftModal
          document={document}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            // The panel shows a snapshot of the row; reopening it shows the saved values.
            handleClose();
          }}
        />
      )}

      <DraftChoiceModal
        isOpen={choiceOpen}
        subject={document?.documentNumber ?? 'This draft'}
        canRedo={!!redoType(document ?? null)}
        isDeleting={deleteDraft.isPending}
        onRedo={() => {
          setRedoTarget(document ?? null);
          handleClose();
        }}
        onDelete={handleDelete}
        onClose={() => setChoiceOpen(false)}
      />

      <VoidEntryModal
        isOpen={voidOpen}
        subject={document?.documentNumber ?? 'This document'}
        isPending={voidEntry.isPending}
        onConfirm={handleVoid}
        onClose={() => setVoidOpen(false)}
      />
      <RestoreEntryModal
        isOpen={restoreOpen}
        subject={document?.documentNumber ?? 'This document'}
        note={isCreditNote ? 'It is applied to its invoice again.' : undefined}
        isPending={restoreEntry.isPending}
        onConfirm={handleRestoreAsIs}
        onClose={() => setRestoreOpen(false)}
      />

      <NewTransactionPanel
        transactionType={redoTarget ? (redoType(redoTarget) ?? undefined) : undefined}
        draft={
          redoTarget && formTarget
            ? { kind: 'document', document: redoTarget, mode: formTarget.mode }
            : null
        }
        onClose={() => setRedoTarget(null)}
      />

      <MakePaymentPanel
        document={receiveRequest ? document : null}
        paymentRequest={receiveRequest}
        onClose={() => setReceiveRequest(null)}
        onRejectRequest={() => {
          setRejectRequest(receiveRequest);
          setReceiveRequest(null);
        }}
      />

      <RejectDraftModal
        isOpen={!!rejectRequest}
        title="Reject Payment Request"
        subject="This payment request"
        description="It is turned down, no payment is recorded, and the reason is shown to whoever asked."
        isRejecting={rejectPaymentRequest.isPending}
        onConfirm={async (rejectionReason) => {
          if (!rejectRequest) return;
          try {
            await rejectPaymentRequest.mutateAsync({
              id: rejectRequest.id,
              reason: rejectionReason,
            });
            toast.success('Payment request rejected.');
            setRejectRequest(null);
          } catch (error) {
            toast.error(extractError(error, 'Failed to reject the request'));
          }
        }}
        onClose={() => setRejectRequest(null)}
      />

      <SourceRecordPanel
        target={appliedTarget}
        onClose={() => setAppliedTarget((t) => (t ? { type: t.type } : null))}
      />

      <RejectDraftModal
        isOpen={rejectOpen}
        subject={`Invoice ${document?.documentNumber ?? ''}`}
        isRejecting={rejectInvoice.isPending}
        onConfirm={handleReject}
        onClose={() => setRejectOpen(false)}
      />

      <Modal
        isOpen={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Reverse Document"
        description="Posted documents are immutable. Reversal creates a reversing journal. Active allocations must be reversed first."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isReversing}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse Document
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Reversal Date"
            type="date"
            value={reversalDate}
            onChange={(e) => setReversalDate(e.target.value)}
          />
          <Input
            label="Reason"
            type="textarea"
            rows={3}
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="e.g. Correction approved by finance"
          />
        </div>
      </Modal>
    </>
  );
}
