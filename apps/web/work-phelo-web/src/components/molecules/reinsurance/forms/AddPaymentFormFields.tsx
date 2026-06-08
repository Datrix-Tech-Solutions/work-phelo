'use client';

import { useEffect, useMemo } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { useFacultatives, useCurrencyOptions } from '@/hooks';

export interface AddPaymentFormValues {
  cedantId: string;
  businessIds: string[];
  paymentType: string;
  // cheque fields
  chequeNumber: string;
  valueDate: string;
  // bank transfer fields
  amount: string;
  // shared
  bankName: string;
  currency: string;
  rate: string;
}

export const ADD_PAYMENT_DEFAULTS: AddPaymentFormValues = {
  cedantId: '',
  businessIds: [],
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  amount: '',
  bankName: '',
  currency: '',
  rate: '',
};

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-700">
        {value || '—'}
      </div>
    </div>
  );
}

interface AddPaymentFormFieldsProps {
  form: UseFormReturn<AddPaymentFormValues>;
  placementId?: string;
  onPlacementsChange?: (placementIds: string[]) => void;
}

export function AddPaymentFormFields({
  form,
  placementId,
  onPlacementsChange,
}: AddPaymentFormFieldsProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { data: facultatives = [] } = useFacultatives();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const preFilledPlacement = useMemo(
    () => (placementId ? facultatives.find((f) => f.id === placementId) : undefined),
    [facultatives, placementId],
  );

  const cedantId = watch('cedantId');
  const businessIds = watch('businessIds');

  useEffect(() => {
    if (preFilledPlacement) {
      setValue('cedantId', preFilledPlacement.cedant.id);
      setValue('businessIds', [preFilledPlacement.id]);
    }
  }, [preFilledPlacement, setValue]);

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of facultatives) {
      if (f.status !== 'CANCELLED') seen.set(f.cedant.id, f.cedant.name);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facultatives]);

  const businessOptions = useMemo(
    () =>
      facultatives
        .filter((f) => f.cedant.id === cedantId && f.status !== 'CANCELLED')
        .map((f) => {
          const parts = [
            f.classOfBusiness,
            f.title,
            f.premium != null
              ? `${f.currency ? f.currency + ' ' : ''}${f.premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : null,
          ].filter(Boolean);
          return {
            value: f.id,
            label: f.policyNumber ?? f.reference,
            sublabel: parts.join(' · '),
          };
        }),
    [facultatives, cedantId],
  );

  const paymentType = watch('paymentType');

  const chequeFields = paymentType === 'cheque' && (
    <>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <FormField
            label="Cheque Number"
            registration={register('chequeNumber', { required: 'Cheque number is required' })}
            placeholder="Enter cheque number…"
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
              />
            )}
          />
        </div>
      </div>

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name…"
        error={errors.bankName}
      />

      <FormField
        label="Amount"
        registration={register('amount', { required: 'Amount is required' })}
        placeholder="0.00"
        type="number"
        error={errors.amount}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />
        <FormField
          label="Rate"
          registration={register('rate', { required: 'Rate is required' })}
          placeholder="0.00"
          type="number"
          error={errors.rate}
        />
      </div>
    </>
  );

  const bankFields = paymentType === 'bank_transfer' && (
    <>
      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name…"
        error={errors.bankName}
      />

      <FormField
        label="Amount"
        registration={register('amount', { required: 'Amount is required' })}
        placeholder="0.00"
        type="number"
        error={errors.amount}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />
        <FormField
          label="Rate"
          registration={register('rate', { required: 'Rate is required' })}
          placeholder="0.00"
          type="number"
          error={errors.rate}
        />
      </div>
    </>
  );

  const paymentTypeField = (
    <Controller
      name="paymentType"
      control={control}
      rules={{ required: 'Payment type is required' }}
      render={({ field }) => (
        <SearchSelect
          label="Payment Type"
          placeholder="Select payment type…"
          options={PAYMENT_TYPE_OPTIONS}
          value={field.value}
          onChange={field.onChange}
          error={errors.paymentType?.message}
        />
      )}
    />
  );

  const businessField = (
    <Controller
      name="businessIds"
      control={control}
      rules={{ validate: (v) => v.length > 0 || 'Select at least one business' }}
      render={({ field }) => (
        <MultiSelect
          label="Business"
          placeholder="Select businesses…"
          options={businessOptions}
          value={field.value}
          onChange={(vals) => {
            field.onChange(vals);
            onPlacementsChange?.(vals);
          }}
          error={errors.businessIds?.message}
        />
      )}
    />
  );

  if (preFilledPlacement) {
    return (
      <div className="flex flex-col gap-5">
        <ReadOnlyField label="Cedant" value={preFilledPlacement.cedant.name} />
        <ReadOnlyField label="Business" value={preFilledPlacement.reference} />
        {paymentTypeField}
        {chequeFields}
        {bankFields}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Controller
        name="cedantId"
        control={control}
        rules={{ required: 'Cedant is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Cedant"
            placeholder="Select cedant…"
            options={cedantOptions}
            value={field.value}
            onChange={(val) => {
              field.onChange(val);
              setValue('businessIds', []);
              onPlacementsChange?.([]);
            }}
            error={errors.cedantId?.message}
          />
        )}
      />
      {cedantId && businessField}
      {businessIds.length > 0 && paymentTypeField}
      {chequeFields}
      {bankFields}
    </div>
  );
}
