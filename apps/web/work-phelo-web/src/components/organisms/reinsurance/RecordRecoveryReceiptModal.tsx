'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useCashAccounts, useCreateClaimRecoveryReceipt, RecoveryRow } from '@/hooks';
import { DetailField } from '@/components/atoms/DetailField';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

interface RecordPaymentValues {
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
  currency: string;
}

const RECORD_PAYMENT_DEFAULTS: RecordPaymentValues = {
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
  currency: '',
};

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Record a reinsurer recovery receipt against an issued cash call. Receipt history (with
 * bank-confirm / reverse) lives in the claim's History tab (`ClaimFinancialHistoryTable`)
 * now, not here — this modal is just the record-payment form. Shared by the standalone
 * cross-placement Recoveries page and the claim detail page's Cash Calls tab — both just need a
 * `RecoveryRow`-shaped row.
 */
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
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentValues>({ defaultValues: RECORD_PAYMENT_DEFAULTS });

  const createReceipt = useCreateClaimRecoveryReceipt();
  const addToast = useToastStore((s) => s.addToast);

  const paymentType = useWatch({ control, name: 'paymentType' });

  // Bank Name picks from Accounting's configured cash/bank accounts for bank
  // transfers, when any exist; falls back to plain text otherwise. Cheques always
  // use plain text — a cheque's drawee bank isn't necessarily one of ours.
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
    if (!row) return;
    try {
      const resolvedDate = values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;
      const amount = Math.round((parseFloat(values.amount) || 0) * 100) / 100;

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

  const chequeBankNameField = (
    <FormField
      label="Bank Name"
      registration={register('bankName', { required: 'Bank name is required' })}
      placeholder="Enter bank name..."
      error={errors.bankName}
    />
  );

  const bankTransferBankNameField = showCashAccountSelect ? (
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
  );

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

      {chequeBankNameField}

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

      {bankTransferBankNameField}

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
          <Button type="submit" form="record-recovery-receipt-form" isLoading={isSubmitting}>
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

        {chequeFields}
        {bankFields}
      </form>
    </SidePanel>
  );
}
