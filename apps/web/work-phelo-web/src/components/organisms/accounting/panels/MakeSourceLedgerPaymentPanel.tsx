'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SourceLedgerEntry } from '@/types/accounting';
import { useCashAccountOptions, useMakeSourceLedgerPayment } from '@/hooks';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type FormValues = {
  amount: string;
  cashAccountId: string;
  settlementMethod: string;
  paymentDate: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS: FormValues = {
  amount: '',
  cashAccountId: '',
  settlementMethod: '',
  paymentDate: '',
};

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function MakeSourceLedgerPaymentPanel({
  entry,
  onClose,
}: {
  entry: SourceLedgerEntry | null;
  onClose: () => void;
}) {
  const isOpen = !!entry;
  const toast = useToast();
  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();
  const makePayment = useMakeSourceLedgerPayment();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      ...DEFAULTS,
      amount: entry && entry.outstandingAmount > 0 ? String(entry.outstandingAmount) : '',
      cashAccountId: cashAccountOptions[0]?.value ?? '',
      paymentDate: today(),
    });
    // Only re-prefill when a different entry is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry?.id, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    if (!entry) return;
    if (!values.cashAccountId) {
      toast.error('Select a cash/bank account.');
      return;
    }
    try {
      await makePayment.mutateAsync({
        entryId: entry.id,
        payload: {
          cashAccountId: values.cashAccountId,
          amount: Number(values.amount),
          transactionDate: values.paymentDate,
          settlementMethod: values.settlementMethod,
        },
      });
      toast.success('Payment recorded.');
      close();
    } catch (error) {
      toast.error(extractError(error, 'Failed to record payment'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title="Make Payment"
      description={entry ? `Recording a payment against ${entry.description}.` : undefined}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={makePayment.isPending}>
            Cancel
          </Button>
          <Button
            isLoading={makePayment.isPending}
            loadingText="Saving…"
            onClick={handleSubmit(onSubmit)}
          >
            Make Payment
          </Button>
        </div>
      }
    >
      {entry && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <SummaryRow label="Item" value={entry.description} />
            <SummaryRow
              label="Account"
              value={`${entry.glAccount.code} — ${entry.glAccount.name}`}
            />
            <SummaryRow label="Total" value={fmtAmount(entry.amount, entry.currency)} />
            <div className="border-t border-gray-100 pt-2">
              <SummaryRow
                label="Outstanding Balance"
                value={fmtAmount(entry.outstandingAmount, entry.currency)}
              />
            </div>
          </div>

          <Controller
            name="amount"
            control={control}
            rules={{
              required: 'Payment amount is required',
              min: { value: 0.01, message: 'Payment amount must be greater than 0' },
              max: {
                value: entry.outstandingAmount,
                message: 'Amount exceeds the outstanding balance',
              },
            }}
            render={({ field }) => (
              <CurrencyInput
                label="Payment Amount"
                value={field.value}
                currency={entry.currency}
                lockCurrency
                onValueChange={field.onChange}
                error={errors.amount?.message}
              />
            )}
          />

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
