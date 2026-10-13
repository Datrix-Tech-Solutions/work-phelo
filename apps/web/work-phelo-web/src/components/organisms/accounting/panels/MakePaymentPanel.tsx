'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  AdjustmentRow,
  adjustmentAmount,
  rowsFromRule,
  SettlementAdjustments,
} from '@/components/organisms/accounting/panels/SettlementAdjustments';
import {
  AccountingTradeDocument,
  AccountingCashbookSettlementMethod,
  PaymentRequest,
} from '@/types/accounting';
import {
  useAllocatePayablePayment,
  useAllocateReceivableReceipt,
  useCashAccountOptions,
  useCompletePaymentRequest,
  useGLAccountOptions,
  useTaxTypes,
  useTransactionTypeRules,
  useCreatePayablePayment,
  useCreateReceivableReceipt,
  usePayableBillBalance,
  usePayableCreditNotes,
  useReceivableCreditNotes,
  useTransactionTypes,
  usePostPayablePayment,
  usePostReceivableReceipt,
  useReceivableInvoiceBalance,
} from '@/hooks';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type FormValues = {
  amount: string;
  cashAccountId: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  paymentDate: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS: FormValues = {
  amount: '',
  cashAccountId: '',
  settlementMethod: '',
  reference: '',
  paymentDate: '',
};

function fmtAmount(amount: string | number, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function fmtDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function MakePaymentPanel({
  document,
  onClose,
  paymentRequest = null,
  onRejectRequest,
}: {
  document: AccountingTradeDocument | null;
  onClose: () => void;
  /** Recording a payment another module asked for: its amount, reference and payer are fixed, and
   *  only the bank, method and date are chosen here. */
  paymentRequest?: PaymentRequest | null;
  /** Offered when the request can no longer be recorded, so it can be turned down instead. */
  onRejectRequest?: () => void;
}) {
  const isOpen = !!document;
  const isReceivable = (document?.side ?? 'RECEIVABLE') === 'RECEIVABLE';
  // Credit notes don't have a balance endpoint — fall back to the document's own total.
  const hasBalance = document?.documentType !== 'CREDIT_NOTE';
  const toast = useToast();

  const receivableBalance = useReceivableInvoiceBalance(
    isReceivable && hasBalance ? document?.id : undefined,
  );
  const payableBalance = usePayableBillBalance(
    !isReceivable && hasBalance ? document?.id : undefined,
  );
  const balance = isReceivable ? receivableBalance.data : payableBalance.data;
  const outstanding = balance?.outstandingAmount ?? document?.totalAmount ?? '0';
  const amountPaid = balance?.appliedSettlements ?? '0';

  // The credit/debit notes that brought the balance down. A newer API lists them on the balance;
  // otherwise they are found from the document's own notes, so the reduction is never unexplained.
  const appliedCreditTotal = Number(balance?.appliedCreditNotes ?? 0);
  const hasListedNotes = (balance?.appliedNotes?.length ?? 0) > 0;
  const needNoteLookup = isOpen && appliedCreditTotal > 0 && !hasListedNotes;
  const noteParams = { partyId: document?.party.id, status: 'POSTED' as const, limit: 100 };
  const receivableNotes = useReceivableCreditNotes(noteParams, {
    enabled: needNoteLookup && isReceivable,
  });
  const payableNotes = usePayableCreditNotes(noteParams, {
    enabled: needNoteLookup && !isReceivable,
  });
  const { data: transactionTypes = [] } = useTransactionTypes();
  const noteRows = useMemo(() => {
    if (hasListedNotes) return balance?.appliedNotes ?? [];
    if (appliedCreditTotal <= 0 || !document) return [];
    const notes = (isReceivable ? receivableNotes.data : payableNotes.data)?.items ?? [];
    const found = notes
      .filter((note) => note.originalDocumentId === document.id)
      .map((note) => ({
        allocationId: note.id,
        documentNumber: note.documentNumber,
        transactionType:
          transactionTypes.find((type) => type.id === note.transactionTypeId)?.name ?? null,
        amount: note.totalAmount,
      }));
    const foundTotal = found.reduce((sum, note) => sum + Number(note.amount), 0);
    // Only itemise when the notes account for the whole reduction; otherwise show it as one line.
    if (found.length > 0 && Math.abs(foundTotal - appliedCreditTotal) < 0.005) return found;
    return [
      {
        allocationId: 'applied-notes',
        documentNumber: null,
        transactionType: null,
        amount: String(appliedCreditTotal),
      },
    ];
  }, [
    hasListedNotes,
    balance?.appliedNotes,
    appliedCreditTotal,
    document,
    isReceivable,
    receivableNotes.data,
    payableNotes.data,
    transactionTypes,
  ]);

  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();

  const completeRequest = useCompletePaymentRequest();
  const createReceipt = useCreateReceivableReceipt();
  const createPayment = useCreatePayablePayment();
  const postReceipt = usePostReceivableReceipt();
  const postPayment = usePostPayablePayment();
  const allocateReceipt = useAllocateReceivableReceipt();
  const allocatePayment = useAllocatePayablePayment();

  const createSettlement = isReceivable ? createReceipt : createPayment;
  const postSettlement = isReceivable ? postReceipt : postPayment;
  const allocateSettlement = isReceivable ? allocateReceipt : allocatePayment;
  const isSaving =
    createSettlement.isPending ||
    postSettlement.isPending ||
    allocateSettlement.isPending ||
    completeRequest.isPending;
  // The invoice may have been paid down (or reversed) since the request was raised.
  const requestExceedsBalance =
    !!paymentRequest &&
    !!balance &&
    Number(balance.outstandingAmount) < Number(paymentRequest.amount);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // Deductions and charges taken at settlement. The bill/invoice's transaction type rule offers
  // its settlement lines as ticks; the user can untick them or add one-off lines.
  const { data: rules = [] } = useTransactionTypeRules();
  const { options: glAccountOptions, isLoading: isLoadingGlAccounts } = useGLAccountOptions();
  const { data: taxTypes = [] } = useTaxTypes();
  const paymentDate = useWatch({ control, name: 'paymentDate' });
  const rule = useMemo(
    () => rules.find((r) => r.transactionTypeId === document?.transactionTypeId),
    [rules, document?.transactionTypeId],
  );
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const settleAmount = Number(useWatch({ control, name: 'amount' })) || 0;
  const activeAdjustments = adjustments.filter((row) => row.enabled);
  const sumOf = (kind: 'DEDUCTION' | 'CHARGE') =>
    activeAdjustments
      .filter((row) => row.kind === kind)
      .reduce((sum, row) => sum + adjustmentAmount(row, settleAmount), 0);
  const deductionsTotal = sumOf('DEDUCTION');
  const chargesTotal = sumOf('CHARGE');
  // The cash that actually moves — what the bank statement will show.
  const cashTotal = settleAmount - deductionsTotal + chargesTotal;

  useEffect(() => {
    if (!isOpen) return;
    reset({
      ...DEFAULTS,
      amount: paymentRequest ? paymentRequest.amount : Number(outstanding) > 0 ? outstanding : '',
      cashAccountId: cashAccountOptions[0]?.value ?? '',
      paymentDate: paymentRequest?.paymentDate ?? today(),
    });
    // Only re-prefill when a different document is opened — not on every balance refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document?.id, paymentRequest?.id, reset]);

  useEffect(() => {
    if (!isOpen) return;
    setAdjustments(rowsFromRule(rule?.lines ?? []));
  }, [isOpen, document?.id, rule?.id, rule?.lines]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    if (!document) return;
    if (!values.cashAccountId) {
      toast.error('Select a cash/bank account.');
      return;
    }

    if (paymentRequest) {
      try {
        await completeRequest.mutateAsync({
          id: paymentRequest.id,
          cashAccountId: values.cashAccountId,
          settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
          receiptDate: values.paymentDate,
        });
        toast.success('Payment recorded.');
        close();
      } catch (error) {
        toast.error(extractError(error, 'Failed to record payment'));
      }
      return;
    }

    for (const row of activeAdjustments) {
      if (!row.glAccountId) {
        toast.error('Select an account on every deduction and charge.');
        return;
      }
      if (!(adjustmentAmount(row, Number(values.amount)) > 0)) {
        toast.error('Every deduction and charge needs an amount above zero.');
        return;
      }
    }
    if (activeAdjustments.length > 0 && !(cashTotal > 0)) {
      toast.error(
        `The deductions leave nothing to ${isReceivable ? 'receive' : 'pay'} — the net amount must be above zero.`,
      );
      return;
    }

    try {
      const settlement = await createSettlement.mutateAsync({
        partyId: document.party.id,
        documentId: document.id,
        cashAccountId: values.cashAccountId,
        amount: Number(values.amount),
        currency: document.currency,
        settlementDate: values.paymentDate,
        settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
        reference: values.reference || undefined,
        ...(activeAdjustments.length > 0
          ? {
              adjustments: activeAdjustments.map((row) => ({
                kind: row.kind,
                glAccountId: row.glAccountId,
                amount: adjustmentAmount(row, Number(values.amount)),
                description: row.description || row.label || undefined,
              })),
            }
          : {}),
      });
      await postSettlement.mutateAsync(settlement.id);
      await allocateSettlement.mutateAsync({
        settlementId: settlement.id,
        documentId: document.id,
        amount: Number(values.amount),
      });
      toast.success('Payment recorded.');
      close();
    } catch (error) {
      toast.error(extractError(error, 'Failed to record payment'));
    }
  };

  const actionLabel = isReceivable ? 'Receive Payment' : 'Make Payment';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title={actionLabel}
      description={document ? `Recording a payment against ${document.documentNumber}.` : undefined}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            isLoading={isSaving}
            loadingText="Saving…"
            disabled={requestExceedsBalance}
            onClick={handleSubmit(onSubmit)}
          >
            {actionLabel}
          </Button>
        </div>
      }
    >
      {document && (
        <div className="flex flex-col gap-3">
          {paymentRequest && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                Requested by {paymentRequest.requestedByName ?? 'a user'} ·{' '}
                {SOURCE_MODULE_LABELS[
                  paymentRequest.sourceModule as keyof typeof SOURCE_MODULE_LABELS
                ] ?? paymentRequest.sourceModule}
                . The client paid {fmtAmount(paymentRequest.amount, paymentRequest.currency)} on{' '}
                {fmtDay(paymentRequest.paymentDate)}
                {paymentRequest.reference ? ` (ref. ${paymentRequest.reference})` : ''}. Choose the
                bank it went into to record it.
              </p>
              {paymentRequest.note && <p className="mt-1">“{paymentRequest.note}”</p>}
            </div>
          )}

          {requestExceedsBalance && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-900">
              <p>
                This invoice now owes {fmtAmount(outstanding, document.currency)}, less than the
                requested {fmtAmount(paymentRequest!.amount, paymentRequest!.currency)}, so it can
                no longer be recorded.
              </p>
              {onRejectRequest && (
                <Button size="sm" variant="danger" className="mt-2" onClick={onRejectRequest}>
                  Reject Request
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <SummaryRow label="Invoice" value={document.documentNumber} />
            <SummaryRow label="Entity" value={document.party.name} />
            <SummaryRow
              label="Invoice Total"
              value={fmtAmount(document.totalAmount, document.currency)}
            />
            {noteRows.map((note) => (
              <SummaryRow
                key={note.allocationId}
                label={
                  note.transactionType || note.documentNumber
                    ? `${isReceivable ? 'Credit note' : 'Debit note'}${
                        note.transactionType ? ` — ${note.transactionType}` : ''
                      }${note.documentNumber ? ` (${note.documentNumber})` : ''}`
                    : isReceivable
                      ? 'Credit notes applied'
                      : 'Debit notes applied'
                }
                value={`− ${fmtAmount(note.amount, document.currency)}`}
              />
            ))}
            <SummaryRow label="Amount Paid" value={fmtAmount(amountPaid, document.currency)} />
            <div className="border-t border-gray-100 pt-2">
              <SummaryRow
                label="Outstanding Balance"
                value={fmtAmount(outstanding, document.currency)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Controller
              name="cashAccountId"
              control={control}
              rules={{ required: 'Cash/bank account is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Cash/Bank Account"
                  placeholder={isLoadingCashAccounts ? 'Loading…' : 'Select cash/bank account…'}
                  options={cashAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cashAccountId?.message}
                />
              )}
            />

            <Controller
              name="settlementMethod"
              control={control}
              rules={{ required: 'Payment method is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Payment Method"
                  placeholder="Select payment method…"
                  options={SETTLEMENT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.settlementMethod?.message}
                />
              )}
            />

            {paymentRequest ? (
              <SummaryRow
                label="Payment Amount"
                value={fmtAmount(paymentRequest.amount, paymentRequest.currency)}
              />
            ) : (
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: 'Payment amount is required',
                  min: { value: 0.01, message: 'Payment amount must be greater than 0' },
                }}
                render={({ field }) => (
                  <CurrencyInput
                    label="Payment Amount"
                    value={field.value}
                    currency={document.currency}
                    lockCurrency
                    onValueChange={field.onChange}
                    error={errors.amount?.message}
                  />
                )}
              />
            )}

            <Controller
              name="paymentDate"
              control={control}
              rules={{ required: 'Payment date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Payment Date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.paymentDate?.message}
                />
              )}
            />
          </div>

          {!paymentRequest && (
            <FormField
              label="Reference"
              registration={register('reference')}
              error={errors.reference}
              placeholder="Optional bank/cheque reference"
            />
          )}

          {!paymentRequest && (
            <>
              <SettlementAdjustments
                rows={adjustments}
                onChange={setAdjustments}
                settleAmount={settleAmount}
                isReceipt={isReceivable}
                currency={document.currency}
                accountOptions={glAccountOptions}
                isLoadingAccounts={isLoadingGlAccounts}
                taxTypes={taxTypes}
                settlementDate={paymentDate}
              />
              {activeAdjustments.length > 0 && (
                <div className="flex flex-col gap-1 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                  <SummaryRow
                    label="Amount settled"
                    value={fmtAmount(settleAmount, document.currency)}
                  />
                  {deductionsTotal > 0 && (
                    <SummaryRow
                      label="Less deductions"
                      value={`− ${fmtAmount(deductionsTotal, document.currency)}`}
                    />
                  )}
                  {chargesTotal > 0 && (
                    <SummaryRow
                      label="Plus charges"
                      value={`+ ${fmtAmount(chargesTotal, document.currency)}`}
                    />
                  )}
                  <div className="border-t border-gray-200 pt-1">
                    <SummaryRow
                      label={isReceivable ? 'Cash received' : 'Cash paid'}
                      value={fmtAmount(cashTotal, document.currency)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
