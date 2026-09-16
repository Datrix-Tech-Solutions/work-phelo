'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { AccountingTradeDocument, AccountingCashbookSettlementMethod } from '@/types/accounting';
import {
  useAllocatePayablePayment,
  useAllocateReceivableReceipt,
  useCashAccountOptions,
  useCreatePayablePayment,
  useCreateReceivableReceipt,
  usePayableBillBalance,
  usePostPayablePayment,
  usePostReceivableReceipt,
  useReceivableInvoiceBalance,
} from '@/hooks';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type FormValues = {
  amount: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  paymentDate: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS: FormValues = {
  amount: '',
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

export function MakePaymentPanel({
  document,
  onClose,
}: {
  document: AccountingTradeDocument | null;
  onClose: () => void;
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

  const { options: cashAccountOptions } = useCashAccountOptions();
  const defaultCashAccountId = cashAccountOptions[0]?.value;

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
    createSettlement.isPending || postSettlement.isPending || allocateSettlement.isPending;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...DEFAULTS, amount: Number(outstanding) > 0 ? outstanding : '', paymentDate: today() });
    // Only re-prefill when a different document is opened — not on every balance refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document?.id, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    if (!document) return;
    if (!defaultCashAccountId) {
      toast.error('No active cash/bank account is configured.');
      return;
    }

    try {
      const settlement = await createSettlement.mutateAsync({
        partyId: document.party.id,
        cashAccountId: defaultCashAccountId,
        amount: Number(values.amount),
        currency: document.currency,
        settlementDate: values.paymentDate,
        settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
        reference: values.reference || undefined,
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
          <Button isLoading={isSaving} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {actionLabel}
          </Button>
        </div>
      }
    >
      {document && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <SummaryRow label="Invoice" value={document.documentNumber} />
            <SummaryRow label="Entity" value={document.party.name} />
            <SummaryRow
              label="Invoice Total"
              value={fmtAmount(document.totalAmount, document.currency)}
            />
            <SummaryRow label="Amount Paid" value={fmtAmount(amountPaid, document.currency)} />
            <div className="border-t border-gray-100 pt-2">
              <SummaryRow
                label="Outstanding Balance"
                value={fmtAmount(outstanding, document.currency)}
              />
            </div>
          </div>

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
