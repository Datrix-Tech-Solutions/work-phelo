'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { api } from '@/lib/api';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect, MultiSelectOption } from '@/components/atoms/MultiSelect';
import {
  AccountingCashbookSettlementMethod,
  AccountingTradeDocument,
  AccountingTradeSide,
} from '@/types/accounting';
import {
  useAllocatePayablePayment,
  useAllocateReceivableReceipt,
  useCashAccountOptions,
  useCreatePayablePayment,
  useCreateReceivableReceipt,
  usePayableBills,
  usePayableCreditNotes,
  usePostPayablePayment,
  usePostReceivableReceipt,
  useReceivableCreditNotes,
  useReceivableInvoices,
} from '@/hooks';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface BulkPaymentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  side: AccountingTradeSide;
  partyId: string;
}

type PaymentFormValues = {
  amount: string;
  cashAccountId: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  paymentDate: string;
  /** Per-document override, keyed by document id — only shown/used when the payment
   *  amount doesn't match the selected documents' combined total. */
  allocations: Record<string, string>;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const PAYMENT_DEFAULTS: PaymentFormValues = {
  amount: '',
  cashAccountId: '',
  settlementMethod: '',
  reference: '',
  paymentDate: '',
  allocations: {},
};

function fmtAmount(amount: string | number, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

export function BulkPaymentPanel({ isOpen, onClose, side, partyId }: BulkPaymentPanelProps) {
  const toast = useToast();
  const isPayable = side === 'PAYABLE';
  const actionLabel = isPayable ? 'Make Payment' : 'Receive Payment';

  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [currency, setCurrency] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const invoices = useReceivableInvoices({ partyId, status: 'POSTED', limit: 100 });
  const bills = usePayableBills({ partyId, status: 'POSTED', limit: 100 });
  const receivableCreditNotes = useReceivableCreditNotes({
    partyId,
    status: 'POSTED',
    limit: 100,
  });
  const payableCreditNotes = usePayableCreditNotes({
    partyId,
    status: 'POSTED',
    limit: 100,
  });

  const documents: AccountingTradeDocument[] = useMemo(
    () =>
      isPayable
        ? [...(bills.data?.items ?? []), ...(payableCreditNotes.data?.items ?? [])]
        : [...(invoices.data?.items ?? []), ...(receivableCreditNotes.data?.items ?? [])],
    [isPayable, bills.data, payableCreditNotes.data, invoices.data, receivableCreditNotes.data],
  );

  const currencyOptions: SearchSelectOption[] = useMemo(
    () => [...new Set(documents.map((doc) => doc.currency))].map((c) => ({ value: c, label: c })),
    [documents],
  );

  const filteredDocuments = useMemo(
    () => (currency ? documents.filter((doc) => doc.currency === currency) : documents),
    [documents, currency],
  );

  const options: MultiSelectOption[] = useMemo(
    () =>
      filteredDocuments.map((doc) => ({
        value: doc.id,
        label: doc.documentNumber,
        sublabel: fmtAmount(doc.totalAmount, doc.currency),
      })),
    [filteredDocuments],
  );

  const selectedDocuments = useMemo(
    () => documents.filter((doc) => selectedIds.includes(doc.id)),
    [documents, selectedIds],
  );

  // Credit notes have no balance endpoint (their full amount is always "due" — they're
  // applied in one shot), so only invoices/bills need an outstanding-balance lookup.
  // There's no batch endpoint, so this fetches each selected one individually.
  const balanceSegment = isPayable ? 'bills' : 'invoices';
  const balanceBase = isPayable ? '/accounting/payables' : '/accounting/receivables';
  const balanceIds = useMemo(
    () =>
      selectedDocuments.filter((doc) => doc.documentType !== 'CREDIT_NOTE').map((doc) => doc.id),
    [selectedDocuments],
  );
  const balancesQuery = useQuery({
    queryKey: ['accounting', side, 'bulk-payment-balances', balanceIds],
    queryFn: async () => {
      const results = await Promise.all(
        balanceIds.map((id) =>
          api.get<{ outstandingAmount: string }>(`${balanceBase}/${balanceSegment}/${id}/balance`),
        ),
      );
      const map = new Map<string, number>();
      results.forEach((res, index) => {
        map.set(balanceIds[index], Number(res.data.outstandingAmount));
      });
      return map;
    },
    enabled: balanceIds.length > 0,
  });

  const outstandingFor = (doc: AccountingTradeDocument) =>
    doc.documentType === 'CREDIT_NOTE'
      ? Number(doc.totalAmount)
      : (balancesQuery.data?.get(doc.id) ?? Number(doc.totalAmount));

  const { options: cashAccountOptions } = useCashAccountOptions();

  const createReceipt = useCreateReceivableReceipt();
  const createPayment = useCreatePayablePayment();
  const postReceipt = usePostReceivableReceipt();
  const postPayment = usePostPayablePayment();
  const allocateReceipt = useAllocateReceivableReceipt();
  const allocatePayment = useAllocatePayablePayment();

  const createSettlement = isPayable ? createPayment : createReceipt;
  const postSettlement = isPayable ? postPayment : postReceipt;
  const allocateSettlement = isPayable ? allocatePayment : allocateReceipt;
  const isSaving =
    createSettlement.isPending || postSettlement.isPending || allocateSettlement.isPending;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PaymentFormValues>({ defaultValues: PAYMENT_DEFAULTS });

  const amount = useWatch({ control, name: 'amount' });
  const allocations = useWatch({ control, name: 'allocations' }) ?? {};
  const parsedAmount = Number(amount) || 0;

  const totalSelected = useMemo(
    () => selectedDocuments.reduce((sum, doc) => sum + outstandingFor(doc), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDocuments, balancesQuery.data],
  );

  // Only worth breaking down when there's more than one document and the entered
  // amount doesn't already match their combined total (a cent of float noise aside).
  const showAllocation =
    selectedDocuments.length > 1 &&
    parsedAmount > 0 &&
    Math.abs(parsedAmount - totalSelected) > 0.01;

  const allocatedTotal = selectedDocuments.reduce(
    (sum, doc) => sum + (Number(allocations[doc.id]) || 0),
    0,
  );
  const remaining = parsedAmount - allocatedTotal;

  // Proportional to each document's outstanding balance — recomputed whenever the
  // amount changes, but only applied to rows the user hasn't manually edited since
  // the last auto-fill.
  const lastAutoAllocations = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!showAllocation) return;
    const next: Record<string, string> = {};
    selectedDocuments.forEach((doc) => {
      const due = outstandingFor(doc);
      const proportion = totalSelected > 0 ? due / totalSelected : 1 / selectedDocuments.length;
      next[doc.id] = (proportion * parsedAmount).toFixed(2);
    });
    const current = getValues('allocations') ?? {};
    const unchanged = selectedDocuments.every(
      (doc) => (current[doc.id] ?? '') === (lastAutoAllocations.current[doc.id] ?? ''),
    );
    if (unchanged) setValue('allocations', next);
    lastAutoAllocations.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllocation, parsedAmount, totalSelected, selectedDocuments]);

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    setSelectedIds([]);
  };

  const handleClose = () => {
    setStep('select');
    setCurrency('');
    setSelectedIds([]);
    reset(PAYMENT_DEFAULTS);
    onClose();
  };

  const goToPayment = () => {
    const total = selectedDocuments.reduce((sum, doc) => sum + outstandingFor(doc), 0);
    reset({ ...PAYMENT_DEFAULTS, amount: total > 0 ? String(total) : '', paymentDate: today() });
    setStep('pay');
  };

  const onSubmit = async (values: PaymentFormValues) => {
    if (selectedDocuments.length === 0 || !values.cashAccountId) return;

    try {
      for (const doc of selectedDocuments) {
        const docAmount = showAllocation
          ? Number(values.allocations[doc.id]) || 0
          : selectedDocuments.length === 1
            ? parsedAmount
            : outstandingFor(doc);
        if (docAmount <= 0) continue;

        const settlement = await createSettlement.mutateAsync({
          partyId,
          documentId: doc.id,
          cashAccountId: values.cashAccountId,
          amount: docAmount,
          currency,
          settlementDate: values.paymentDate,
          settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
          reference: values.reference || undefined,
        });
        await postSettlement.mutateAsync(settlement.id);
        await allocateSettlement.mutateAsync({
          settlementId: settlement.id,
          documentId: doc.id,
          amount: docAmount,
        });
      }

      toast.success('Payments recorded.');
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to record payment'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={actionLabel}
      description={
        step === 'select'
          ? 'Select the posted transactions to include in this payment.'
          : `Recording ${selectedDocuments.length} separate payment(s) to the same cash account.`
      }
      footer={
        step === 'select' ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={goToPayment} disabled={selectedDocuments.length === 0}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('select')} disabled={isSaving}>
              Back
            </Button>
            <Button isLoading={isSaving} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
              {actionLabel}
            </Button>
          </div>
        )
      }
    >
      {step === 'select' ? (
        <div className="flex flex-col gap-4">
          <SearchSelect
            label="Currency"
            placeholder="Select currency…"
            options={currencyOptions}
            value={currency}
            onChange={handleCurrencyChange}
          />

          <MultiSelect
            label="Documents"
            placeholder="Select posted transactions…"
            options={options}
            value={selectedIds}
            onChange={setSelectedIds}
            hideChips
          />

          {selectedDocuments.length > 0 && (
            <div className="flex flex-col gap-2">
              {selectedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {doc.documentNumber}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {fmtAmount(outstandingFor(doc), doc.currency)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {doc.description || 'No description'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
                currency={currency}
                lockCurrency
                onValueChange={field.onChange}
                error={errors.amount?.message}
              />
            )}
          />

          {showAllocation ? (
            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-700">Allocate Payment</p>
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.documentNumber}
                    </p>
                    <p className="text-xs text-gray-400">
                      {fmtAmount(outstandingFor(doc), doc.currency)} due
                    </p>
                  </div>
                  <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                    <span className="text-xs text-gray-400">Amount</span>
                    <Controller
                      name={`allocations.${doc.id}`}
                      control={control}
                      render={({ field }) => (
                        <NumberField
                          value={Number(field.value) || 0}
                          onChange={(value) => field.onChange(String(value))}
                          placeholder="0.00"
                          className="w-32 px-2 py-2 text-xs text-right"
                        />
                      )}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 border-t border-gray-200 text-xs">
                <span className="text-gray-500">
                  Allocated: {fmtAmount(allocatedTotal, currency)}
                </span>
                <span
                  className={
                    remaining < 0
                      ? 'text-red-500 font-medium'
                      : remaining > 0
                        ? 'text-orange-500 font-medium'
                        : 'text-green-600 font-medium'
                  }
                >
                  {remaining > 0
                    ? `${fmtAmount(remaining, currency)} remaining`
                    : remaining < 0
                      ? `${fmtAmount(Math.abs(remaining), currency)} over`
                      : 'Fully allocated'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {doc.documentNumber}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {fmtAmount(outstandingFor(doc), doc.currency)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {doc.description || 'No description'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Controller
            name="cashAccountId"
            control={control}
            rules={{ required: 'Cash/bank account is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Cash/Bank Account"
                placeholder="Select cash/bank account…"
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

          <FormField
            label="Reference"
            registration={register('reference')}
            error={errors.reference}
            placeholder="Optional bank/cheque reference"
          />

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
      )}
    </SidePanel>
  );
}
