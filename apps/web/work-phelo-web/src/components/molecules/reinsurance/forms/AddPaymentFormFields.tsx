'use client';

import { useEffect, useMemo } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { useFacultatives, useCurrencyOptions } from '@/hooks';
import { cn, inputClass } from '@/lib/utils';

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
  allocations: Record<string, string>;
  allocationRates: Record<string, string>;
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
  allocations: {},
  allocationRates: {},
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
          const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
          const netPremium = facPremium * (1 - (f.commission ?? 0) / 100);
          const parts = [
            f.classOfBusiness,
            f.title,
            f.premium != null
              ? `${f.currency ? f.currency + ' ' : ''}${netPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const totalExpected = useMemo(() => {
    const selected = facultatives.filter((f) => businessIds.includes(f.id));
    return selected.reduce((sum, f) => {
      const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
      return sum + facPremium * (1 - (f.commission ?? 0) / 100);
    }, 0);
  }, [facultatives, businessIds]);

  const expectedCurrency = useMemo(
    () => facultatives.find((f) => businessIds.includes(f.id))?.currency ?? null,
    [facultatives, businessIds],
  );

  const paymentType = watch('paymentType');
  const paymentCurrency = watch('currency');
  const amountValue = watch('amount');
  const allocations = useWatch({ control, name: 'allocations' });

  const parsedAmount = parseFloat(amountValue) || 0;

  const selectedFacultatives = useMemo(
    () => facultatives.filter((f) => businessIds.includes(f.id)),
    [facultatives, businessIds],
  );

  const allSameCurrency = useMemo(() => {
    if (selectedFacultatives.length <= 1) return true;
    const first = selectedFacultatives[0].currency;
    return selectedFacultatives.every((f) => f.currency === first);
  }, [selectedFacultatives]);

  const businessCurrency = preFilledPlacement?.currency ?? expectedCurrency;
  const showRate =
    !!paymentCurrency &&
    !!businessCurrency &&
    paymentCurrency !== businessCurrency &&
    allSameCurrency;

  const showAllocation =
    businessIds.length > 1 && parsedAmount > 0 && Math.abs(parsedAmount - totalExpected) > 0.01;

  useEffect(() => {
    if (!showRate) setValue('rate', '');
  }, [showRate, setValue]);

  useEffect(() => {
    if (!showAllocation) return;
    const newAllocations: Record<string, string> = {};
    selectedFacultatives.forEach((f) => {
      const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
      const netPremium = facPremium * (1 - (f.commission ?? 0) / 100);
      const proportion =
        totalExpected > 0 ? netPremium / totalExpected : 1 / selectedFacultatives.length;
      newAllocations[f.id] = (proportion * parsedAmount).toFixed(2);
    });
    setValue('allocations', newAllocations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllocation, parsedAmount, totalExpected]);

  const allocatedTotal = Object.values(allocations ?? {}).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );
  const remaining = parsedAmount - allocatedTotal;

  const fmtNum = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalExpectedHint =
    businessIds.length > 1 ? (
      <p className="text-xs text-gray-500 mt-1">
        Expected total:{' '}
        <span className="font-medium text-gray-700">
          {expectedCurrency ? `${expectedCurrency} ` : ''}
          {totalExpected.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </p>
    ) : null;

  const allocationSection = showAllocation && (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-xs font-semibold text-gray-700">Allocate Payment</p>
      {selectedFacultatives.map((f) => {
        const facPremium = ((f.facultativeOffer ?? 0) / 100) * (f.premium ?? 0);
        const netPremium = facPremium * (1 - (f.commission ?? 0) / 100);
        const rowNeedsRate =
          !allSameCurrency && !!paymentCurrency && !!f.currency && paymentCurrency !== f.currency;
        return (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {f.policyNumber ?? f.reference}
              </p>
              <p className="text-xs text-gray-400">
                {f.currency ? `${f.currency} ` : ''}
                {fmtNum(netPremium)} due
              </p>
            </div>
            {rowNeedsRate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Rate</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className={cn(inputClass(), 'w-20 px-2 py-2 text-xs text-right')}
                  {...register(`allocationRates.${f.id}` as `allocationRates.${string}`)}
                />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">Amount</span>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                className={cn(inputClass(), 'w-32 px-2 py-2 text-xs text-right')}
                {...register(`allocations.${f.id}` as `allocations.${string}`)}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1 border-t border-gray-200 text-xs">
        <span className="text-gray-500">Allocated: {fmtNum(allocatedTotal)}</span>
        <span
          className={cn(
            'font-medium',
            remaining < 0 ? 'text-red-500' : remaining > 0 ? 'text-orange-500' : 'text-green-600',
          )}
        >
          {remaining > 0
            ? `${fmtNum(remaining)} remaining`
            : remaining < 0
              ? `${fmtNum(Math.abs(remaining))} over`
              : 'Fully allocated'}
        </span>
      </div>
    </div>
  );

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

      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
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
        {showRate && (
          <FormField
            label="Rate"
            registration={register('rate', { required: 'Rate is required' })}
            placeholder="0.00"
            type="number"
            step="any"
            error={errors.rate}
          />
        )}
      </div>
      <div>
        <FormField
          label="Amount"
          registration={register('amount', { required: 'Amount is required' })}
          placeholder="0.00"
          type="number"
          error={errors.amount}
        />
        {totalExpectedHint}
      </div>
      {allocationSection}
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

      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
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
        {showRate && (
          <FormField
            label="Rate"
            registration={register('rate', { required: 'Rate is required' })}
            placeholder="0.00"
            type="number"
            step="any"
            error={errors.rate}
          />
        )}
      </div>
      <div>
        <FormField
          label="Amount"
          registration={register('amount', { required: 'Amount is required' })}
          placeholder="0.00"
          type="number"
          error={errors.amount}
        />
        {totalExpectedHint}
      </div>
      {allocationSection}
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
