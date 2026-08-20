'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  useCashAccounts,
  useCreateClaimRecoveryReceipt,
  useCurrencyOptions,
  RecoveryRow,
} from '@/hooks';
import { DetailField } from '@/components/atoms/DetailField';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import {
  OFFSET_CLAIM_RECEIPT_NOTE,
  DIRECT_TO_CEDANT_RECEIPT_NOTE,
} from '@/lib/reinsurance/claimFormat';

interface RecordPaymentValues {
  mode: string;
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
  currency: string;
  /** Conversion rate into the cash call's own currency — only used when `currency` differs
   * from it, on the Direct to Cedant path. */
  rate: string;
}

const RECORD_PAYMENT_DEFAULTS: RecordPaymentValues = {
  mode: '',
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
  currency: '',
  rate: '',
};

const MODE_OPTIONS = [
  { value: 'broker', label: 'To Broker' },
  { value: 'cedant', label: 'Direct to Cedant' },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'offset_claim', label: 'Offset Claim' },
];

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RecordRecoveryReceiptModal({
  row,
  onClose,
}: {
  row: RecoveryRow | null;
  onClose: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentValues>({
    defaultValues: RECORD_PAYMENT_DEFAULTS,
    shouldUnregister: true,
  });

  const createReceipt = useCreateClaimRecoveryReceipt();
  const addToast = useToastStore((s) => s.addToast);

  const mode = useWatch({ control, name: 'mode' });
  const paymentType = useWatch({ control, name: 'paymentType' });
  const directCurrency = useWatch({ control, name: 'currency' });
  const { data: currencyOptions = [] } = useCurrencyOptions();
  const isDirectEntry = mode === 'cedant' || paymentType === 'offset_claim';

  const showRate =
    isDirectEntry && !!directCurrency && !!row?.currency && directCurrency !== row.currency;

  useEffect(() => {
    if (!showRate) setValue('rate', '');
  }, [showRate, setValue]);

  const { data: cashAccounts = [], isLoading: isLoadingCashAccounts } = useCashAccounts({
    isActive: true,
  });
  const cashAccountOptions: SearchSelectOption[] = cashAccounts.map((account) => ({
    value: account.name,
    label: account.name,
    sublabel: [account.bankName, account.currency].filter(Boolean).join(' · ') || undefined,
  }));
  const showCashAccountSelect = !isLoadingCashAccounts && cashAccountOptions.length > 0;

  useEffect(() => {
    if (row) {
      reset({
        ...RECORD_PAYMENT_DEFAULTS,
        amount: row.outstandingAmount > 0 ? String(row.outstandingAmount) : '',
        currency: row.currency,
      });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset(RECORD_PAYMENT_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: RecordPaymentValues) => {
    if (!row) {
      addToast({ message: 'No cash call selected — please reopen this panel.', type: 'error' });
      return;
    }
    try {
      const amount = Math.round((parseFloat(values.amount) || 0) * 100) / 100;

      const isDirectEntry = values.mode === 'cedant' || values.paymentType === 'offset_claim';
      if (isDirectEntry) {
        const needsConversion = values.currency !== row.currency;
        const convertedAmount = needsConversion
          ? Math.round(amount * (parseFloat(values.rate) || 1) * 100) / 100
          : amount;

        await createReceipt.mutateAsync({
          placementId: row.placementId,
          claimId: row.claimId,
          cashCallId: row.cashCallId,
          payload: {
            amount: convertedAmount,
            currency: row.currency,
            paymentDate: new Date(values.paymentDate).toISOString(),
            notes:
              values.mode === 'cedant' ? DIRECT_TO_CEDANT_RECEIPT_NOTE : OFFSET_CLAIM_RECEIPT_NOTE,
          },
        });
        addToast({ message: 'Recovery receipt recorded', type: 'success' });
        handleClose();
        return;
      }

      const resolvedDate = values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;

      const refParts: string[] = [];
      if (values.chequeNumber) refParts.push(values.chequeNumber);
      if (values.bankName) refParts.push(values.bankName);

      await createReceipt.mutateAsync({
        placementId: row.placementId,
        claimId: row.claimId,
        cashCallId: row.cashCallId,
        payload: {
          amount,
          currency: row.currency,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference: refParts.join(' - ') || undefined,
          notes: values.bankName ? `Received via ${values.bankName}` : undefined,
        },
      });
      addToast({ message: 'Recovery receipt recorded', type: 'success' });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  // Bank Name's register()/Controller calls are inlined directly inside each conditional block
  // below (like chequeNumber/valueDate already are) rather than factored into always-computed
  // consts — react-hook-form doesn't reliably pick up changed `rules` on a field that's already
  // registered from an earlier render, so the only solid way to make a field's requirement
  // conditional is to only ever call register()/Controller for it at all when its branch is
  // actually active.
  const chequeFields = paymentType === 'cheque' && (
    <>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <FormField
            label="Cheque Number"
            registration={register('chequeNumber', { required: 'Cheque number is required' })}
            placeholder="Enter cheque number..."
            error={errors.chequeNumber}
          />
        </div>
        <div className="col-span-2">
          <Controller
            name="valueDate"
            control={control}
            rules={{ required: 'Value date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Value Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.valueDate?.message}
                size="sm"
              />
            )}
          />
        </div>
      </div>

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name..."
        error={errors.bankName}
      />

      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount Received"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
    </>
  );

  const bankFields = paymentType === 'bank_transfer' && (
    <>
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
            size="sm"
          />
        )}
      />

      {showCashAccountSelect ? (
        <Controller
          name="bankName"
          control={control}
          rules={{ required: 'Bank name is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Bank Name"
              placeholder="Select cash/bank account..."
              options={cashAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.bankName?.message}
              size="sm"
            />
          )}
        />
      ) : (
        <FormField
          label="Bank Name"
          registration={register('bankName', { required: 'Bank name is required' })}
          placeholder="Enter bank name..."
          error={errors.bankName}
        />
      )}

      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount Received"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
    </>
  );

  const directEntryFields = isDirectEntry && (
    <>
      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency..."
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
              size="sm"
            />
          )}
        />
        {showRate && (
          <Controller
            name="rate"
            control={control}
            rules={{ min: { value: 0.000001, message: 'Rate is required' } }}
            render={({ field }) => (
              <NumberField
                label={`Rate to ${row?.currency ?? ''}`}
                value={field.value ? Number(field.value) : 0}
                onChange={(n) => field.onChange(String(n))}
                error={errors.rate?.message}
                placeholder="0.00"
              />
            )}
          />
        )}
      </div>
      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        name="paymentDate"
        control={control}
        rules={{ required: 'Date of payment is required' }}
        render={({ field }) => (
          <DatePicker
            label="Date of Payment"
            value={field.value}
            onChange={field.onChange}
            error={errors.paymentDate?.message}
            size="sm"
          />
        )}
      />
    </>
  );

  return (
    <SidePanel
      isOpen={!!row}
      onClose={handleClose}
      title="Record Recovery Receipt"
      description={row ? `${row.reinsurerName} - ${row.claimNumber}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              handleSubmit(onSubmit, (formErrors) => {
                // A field can fail validation while being registered from a branch that's no
                // longer rendered, so its own error text has nowhere to show. Surface it here
                // instead of letting the click silently do nothing.
                const [firstError] = Object.values(formErrors);
                addToast({
                  message: firstError?.message ?? 'Please check the form and try again.',
                  type: 'error',
                });
              })().catch((error) => {
                addToast({ message: extractError(error), type: 'error' });
              });
            }}
            isLoading={isSubmitting}
          >
            Record Recovery
          </Button>
        </div>
      }
    >
      {row && (
        <div className={cardClass('flex flex-col gap-2 p-4 mt-5')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
            <span className="font-medium text-gray-900">{row.policyNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.insuredTitle}</span>
            <span className="text-gray-300">·</span>
            <span>{row.riskType ?? '—'}</span>
            <span className="text-gray-300">·</span>
            <span>{row.reinsurerName}</span>
            <span className="text-gray-300">·</span>
            <span>{row.claimNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.cashCallNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.currency}</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <DetailField
              horizontal
              label="Outstanding Recovery"
              value={
                <span className="font-semibold text-gray-900">
                  {fmtAmount(row.outstandingAmount, row.currency)}
                </span>
              }
            />
          </div>
        </div>
      )}

      <form
        id="record-recovery-receipt-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5 mt-5"
      >
        <Controller
          name="mode"
          control={control}
          rules={{ required: 'Mode of payment is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Mode of Payment"
              placeholder="Select mode of payment..."
              options={MODE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.mode?.message}
              size="sm"
            />
          )}
        />

        {mode === 'broker' && (
          <Controller
            name="paymentType"
            control={control}
            rules={{ required: 'Payment type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Payment Type"
                placeholder="Select payment type..."
                options={PAYMENT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.paymentType?.message}
                size="sm"
              />
            )}
          />
        )}

        {chequeFields}
        {bankFields}
        {directEntryFields}
      </form>
    </SidePanel>
  );
}
