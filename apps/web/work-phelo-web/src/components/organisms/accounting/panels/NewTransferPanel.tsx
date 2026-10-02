'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { useCashAccounts, useCreateCashbookTransfer, useGLAccountOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

function fmtAmount(value: number, currency: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

type FormValues = {
  cashAccountId: string;
  destinationCashAccountId: string;
  amount: string;
  exchangeRate: string;
  transactionDate: string;
  reference: string;
  description: string;
  hasCharge: boolean;
  chargeAmount: string;
  chargeGlAccountId: string;
};

const DEFAULTS: FormValues = {
  cashAccountId: '',
  destinationCashAccountId: '',
  amount: '',
  exchangeRate: '',
  transactionDate: '',
  reference: '',
  description: '',
  hasCharge: false,
  chargeAmount: '',
  chargeGlAccountId: '',
};

export function NewTransferPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const createTransfer = useCreateCashbookTransfer();
  const { data: cashAccounts = [], isLoading: isLoadingCashAccounts } = useCashAccounts({
    isActive: true,
  });
  const { options: glAccountOptions, isLoading: isLoadingGlAccounts } = useGLAccountOptions();
  const [successOpen, setSuccessOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // Reset whenever the panel transitions to open. This has to be an effect, not an
  // inline reset during render — react-hook-form's reset() updates Controller's
  // internal subscription synchronously, and doing that while NewTransferPanel itself
  // is still rendering trips React's "setState on a different component during
  // render" warning.
  useEffect(() => {
    if (isOpen) reset({ ...DEFAULTS, transactionDate: today() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cashAccountId = useWatch({ control, name: 'cashAccountId' });
  const destinationCashAccountId = useWatch({ control, name: 'destinationCashAccountId' });
  const amount = useWatch({ control, name: 'amount' });
  const hasCharge = useWatch({ control, name: 'hasCharge' });
  const chargeAmount = useWatch({ control, name: 'chargeAmount' });

  const sourceAccount = useMemo(
    () => cashAccounts.find((a) => a.id === cashAccountId),
    [cashAccounts, cashAccountId],
  );
  const destinationAccount = useMemo(
    () => cashAccounts.find((a) => a.id === destinationCashAccountId),
    [cashAccounts, destinationCashAccountId],
  );
  const isCrossCurrency = !!(
    sourceAccount &&
    destinationAccount &&
    sourceAccount.currency !== destinationAccount.currency
  );

  const sourceOptions = useMemo<SearchSelectOption[]>(
    () =>
      cashAccounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.currency})`,
      })),
    [cashAccounts],
  );
  // A transfer can't move money from an account to itself.
  const destinationOptions = useMemo<SearchSelectOption[]>(
    () =>
      cashAccounts
        .filter((a) => a.id !== cashAccountId)
        .map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
    [cashAccounts, cashAccountId],
  );

  const amountValue = Number(amount) || 0;
  const chargeAmountValue = hasCharge ? Number(chargeAmount) || 0 : 0;

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    if (!sourceAccount) {
      toast.error('Select the account to transfer from');
      return;
    }
    if (!destinationAccount) {
      toast.error('Select the account to transfer to');
      return;
    }
    if (isCrossCurrency && !values.exchangeRate) {
      toast.error('Cross-currency transfers require an exchange rate');
      return;
    }
    if (values.hasCharge && !values.chargeGlAccountId) {
      toast.error('Select the account to charge the transfer fee to');
      return;
    }

    try {
      await createTransfer.mutateAsync({
        cashAccountId: sourceAccount.id,
        destinationCashAccountId: destinationAccount.id,
        amount: Number(values.amount),
        currency: sourceAccount.currency,
        transactionDate: values.transactionDate || today(),
        exchangeRate: isCrossCurrency ? Number(values.exchangeRate) : undefined,
        reference: values.reference || undefined,
        description: values.description || `Transfer to ${destinationAccount.name}`,
        chargeAmount: values.hasCharge ? Number(values.chargeAmount) : undefined,
        chargeGlAccountId: values.hasCharge ? values.chargeGlAccountId : undefined,
      });
      close();
      setSuccessOpen(true);
    } catch (error) {
      toast.error(extractError(error, 'Failed to create transfer'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={close}
        title="New Transfer"
        description="Move funds between two of your cash/bank accounts."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={close} disabled={createTransfer.isPending}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              isLoading={createTransfer.isPending}
              loadingText="Submitting…"
              disabled={createTransfer.isPending}
              onClick={handleSubmit(submit)}
            >
              Submit for Review
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Controller
            name="cashAccountId"
            control={control}
            rules={{ required: 'From account is required' }}
            render={({ field }) => (
              <SearchSelect
                label="From Account"
                placeholder={isLoadingCashAccounts ? 'Loading…' : 'Select source account…'}
                options={sourceOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.cashAccountId?.message}
              />
            )}
          />

          <Controller
            name="destinationCashAccountId"
            control={control}
            rules={{ required: 'To account is required' }}
            render={({ field }) => (
              <SearchSelect
                label="To Account"
                placeholder={
                  !cashAccountId
                    ? 'Select a source account first…'
                    : isLoadingCashAccounts
                      ? 'Loading…'
                      : 'Select destination account…'
                }
                options={destinationOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.destinationCashAccountId?.message}
              />
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="amount"
              control={control}
              rules={{
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' },
              }}
              render={({ field }) => (
                <NumberField
                  label="Amount"
                  value={Number(field.value) || 0}
                  onChange={(value) => field.onChange(String(value))}
                  error={errors.amount?.message}
                />
              )}
            />
            <Input label="Currency" readOnly value={sourceAccount?.currency ?? '—'} />
          </div>

          {isCrossCurrency && (
            <Controller
              name="exchangeRate"
              control={control}
              rules={{ required: 'Exchange rate is required for cross-currency transfers' }}
              render={({ field }) => (
                <NumberField
                  label={`Exchange Rate (${sourceAccount?.currency} → ${destinationAccount?.currency})`}
                  value={Number(field.value) || 0}
                  onChange={(value) => field.onChange(String(value))}
                  error={errors.exchangeRate?.message}
                />
              )}
            />
          )}

          <Controller
            name="transactionDate"
            control={control}
            rules={{ required: 'Date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Transfer Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.transactionDate?.message}
              />
            )}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('hasCharge')}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">This transfer incurred a bank charge</span>
          </label>

          {hasCharge && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-3">
              <Controller
                name="chargeAmount"
                control={control}
                rules={{
                  required: hasCharge ? 'Charge amount is required' : false,
                  min: { value: 0.01, message: 'Charge must be greater than 0' },
                }}
                render={({ field }) => (
                  <NumberField
                    label="Charge Amount"
                    value={Number(field.value) || 0}
                    onChange={(value) => field.onChange(String(value))}
                    error={errors.chargeAmount?.message}
                  />
                )}
              />
              <Controller
                name="chargeGlAccountId"
                control={control}
                rules={{ required: hasCharge ? 'Charges account is required' : false }}
                render={({ field }) => (
                  <SearchSelect
                    label="Charges Account"
                    placeholder={isLoadingGlAccounts ? 'Loading…' : 'Select charges account…'}
                    options={glAccountOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.chargeGlAccountId?.message}
                  />
                )}
              />
            </div>
          )}

          {sourceAccount && destinationAccount && amountValue > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{sourceAccount.name}</span>
                <span className="font-semibold text-red-600">
                  −{fmtAmount(amountValue + chargeAmountValue, sourceAccount.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{destinationAccount.name}</span>
                <span className="font-semibold text-green-600">
                  +{fmtAmount(amountValue, destinationAccount.currency)}
                </span>
              </div>
              {chargeAmountValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Charges</span>
                  <span className="font-semibold text-gray-900">
                    {fmtAmount(chargeAmountValue, sourceAccount.currency)}
                  </span>
                </div>
              )}
            </div>
          )}

          <FormField
            label="Reference"
            registration={register('reference')}
            placeholder="Optional bank/cheque reference"
          />

          <FormField
            label="Description"
            type="textarea"
            rows={3}
            registration={register('description')}
            placeholder="What is this transfer for?"
          />
        </div>
      </SidePanel>

      <SuccessModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Transfer Submitted!"
        message="Your transfer has been submitted for review."
      />
    </>
  );
}
