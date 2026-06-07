'use client';

import { useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { FormSection } from '@/components/atoms/FormSection';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { inputClass } from '@/lib/utils';
import { useFacultatives } from '@/hooks';

export interface AddPaymentFormValues {
  placementId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string;
  currency: string;
  reference: string;
  notes: string;
}

export const ADD_PAYMENT_DEFAULTS: AddPaymentFormValues = {
  placementId: '',
  paymentDate: '',
  paymentMethod: '',
  amount: '',
  currency: 'GHS',
  reference: '',
  notes: '',
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

interface AddPaymentFormFieldsProps {
  form: UseFormReturn<AddPaymentFormValues>;
}

export function AddPaymentFormFields({ form }: AddPaymentFormFieldsProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { data: facultatives = [] } = useFacultatives();
  const searchParams = useSearchParams();

  useEffect(() => {
    const placementId = searchParams.get('placementId');
    if (placementId) setValue('placementId', placementId);
  }, [searchParams, setValue]);

  const policyOptions = facultatives.map((f) => ({
    value: f.id,
    label: f.reference,
    sublabel: f.title,
  }));

  const currency = watch('currency');

  return (
    <div className="flex flex-col gap-7">
      <FormSection title="Policy">
        <Controller
          name="placementId"
          control={control}
          rules={{ required: 'Policy is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Policy Number"
              placeholder="Select policy…"
              options={policyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.placementId?.message}
            />
          )}
        />
      </FormSection>

      <FormSection title="Payment Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                disableFuture
              />
            )}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">Payment Method</label>
            <select
              {...register('paymentMethod', { required: 'Payment method is required' })}
              className={inputClass(errors.paymentMethod?.message)}
            >
              <option value="">Select method…</option>
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="text-xs text-red-500">{errors.paymentMethod.message}</p>
            )}
          </div>
        </div>

        <Controller
          name="amount"
          control={control}
          rules={{ required: 'Amount is required' }}
          render={() => (
            <CurrencyInput
              label="Amount"
              value={watch('amount')}
              currency={currency}
              onValueChange={(v) => setValue('amount', v)}
              onCurrencyChange={(c) => setValue('currency', c)}
              error={errors.amount?.message}
            />
          )}
        />

        <FormField
          label="Payment Reference"
          registration={register('reference')}
          placeholder="Cheque number, bank reference…"
          error={errors.reference}
        />

        <FormField
          label="Notes"
          registration={register('notes')}
          type="textarea"
          placeholder="Additional notes…"
          error={errors.notes}
        />
      </FormSection>
    </div>
  );
}
