'use client';

import { useEffect, useMemo } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { useQueries } from '@tanstack/react-query';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { FormField } from '@/components/molecules/shared/FormField';
import { useFacultatives, useCurrencyOptions } from '@/hooks';
import { api } from '@/lib/api';
import { cn, inputClass } from '@/lib/utils';
import { PlacementClaim, PlacementPayment } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

export interface AddClaimPaymentFormValues {
  cedantId: string;
  businessIds: string[];
  paymentType: string;
  // cheque fields
  chequeNumber: string;
  valueDate: string;
  // bank transfer fields
  paymentDate: string;
  // shared
  amount: string;
  bankName: string;
  currency: string;
  rate: string;
  allocations: Record<string, string>;
  allocationRates: Record<string, string>;
}

export const ADD_CLAIM_PAYMENT_DEFAULTS: AddClaimPaymentFormValues = {
  cedantId: '',
  businessIds: [],
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
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

interface AddClaimPaymentFormFieldsProps {
  form: UseFormReturn<AddClaimPaymentFormValues>;
  onPlacementsChange?: (placementIds: string[]) => void;
}

export function AddClaimPaymentFormFields({
  form,
  onPlacementsChange,
}: AddClaimPaymentFormFieldsProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { data: facultatives = [] } = useFacultatives();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const claimQueries = useQueries({
    queries: facultatives.map((f) => ({
      queryKey: ['reinsurance', 'placements', f.id, 'claims'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${f.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const paymentQueries = useQueries({
    queries: facultatives.map((f) => ({
      queryKey: ['reinsurance', 'placements', f.id, 'payments'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${f.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const claimByPlacement = useMemo(() => {
    const map = new Map<string, PlacementClaim>();
    facultatives.forEach((f, i) => {
      const claim = claimQueries[i]?.data?.[0];
      if (claim) map.set(f.id, claim);
    });
    return map;
  }, [facultatives, claimQueries]);

  const outstandingByPlacement = useMemo(() => {
    const map = new Map<string, number>();
    facultatives.forEach((f, i) => {
      const claim = claimByPlacement.get(f.id);
      if (!claim) return;
      const claimAmount = parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount) || 0;
      const payments = paymentQueries[i]?.data ?? [];
      const paid = payments
        .filter((p) => p.type === 'CLAIM_SETTLEMENT' && p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      map.set(f.id, Math.max(0, claimAmount - paid));
    });
    return map;
  }, [facultatives, claimByPlacement, paymentQueries]);

  const cedantId = watch('cedantId');
  const businessIds = watch('businessIds');

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of facultatives) {
      if (f.status !== 'CANCELLED' && claimByPlacement.has(f.id))
        seen.set(f.cedant.id, f.cedant.name);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facultatives, claimByPlacement]);

  const businessOptions = useMemo(
    () =>
      facultatives
        .filter(
          (f) => f.cedant.id === cedantId && f.status !== 'CANCELLED' && claimByPlacement.has(f.id),
        )
        .map((f) => {
          const claim = claimByPlacement.get(f.id);
          const outstanding = outstandingByPlacement.get(f.id) ?? 0;
          const currency = claim?.currency ?? f.currency ?? '';
          const parts = [
            claim?.claimNumber,
            `${currency ? currency + ' ' : ''}${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding`,
          ].filter(Boolean);
          return {
            value: f.id,
            label: displayPolicyNumber(f.policyNumber),
            sublabel: parts.join(' · '),
          };
        }),
    [facultatives, cedantId, claimByPlacement, outstandingByPlacement],
  );

  const totalExpected = useMemo(() => {
    return businessIds.reduce((sum, id) => sum + (outstandingByPlacement.get(id) ?? 0), 0);
  }, [businessIds, outstandingByPlacement]);

  const expectedCurrency = useMemo(() => {
    const firstId = businessIds.find((id) => claimByPlacement.has(id));
    if (!firstId) return null;
    return claimByPlacement.get(firstId)?.currency ?? null;
  }, [businessIds, claimByPlacement]);

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
    const first =
      claimByPlacement.get(selectedFacultatives[0].id)?.currency ??
      selectedFacultatives[0].currency;
    return selectedFacultatives.every(
      (f) => (claimByPlacement.get(f.id)?.currency ?? f.currency) === first,
    );
  }, [selectedFacultatives, claimByPlacement]);

  const businessCurrency = expectedCurrency;
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
      const outstanding = outstandingByPlacement.get(f.id) ?? 0;
      const proportion =
        totalExpected > 0 ? outstanding / totalExpected : 1 / selectedFacultatives.length;
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
        Total outstanding:{' '}
        <span className="font-medium text-gray-700">
          {expectedCurrency ? `${expectedCurrency} ` : ''}
          {fmtNum(totalExpected)}
        </span>
      </p>
    ) : null;

  const allocationSection = showAllocation && (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-xs font-semibold text-gray-700">Allocate Payment</p>
      {selectedFacultatives.map((f) => {
        const claim = claimByPlacement.get(f.id);
        const outstanding = outstandingByPlacement.get(f.id) ?? 0;
        const claimCurrency = claim?.currency ?? f.currency;
        const rowNeedsRate =
          !allSameCurrency &&
          !!paymentCurrency &&
          !!claimCurrency &&
          paymentCurrency !== claimCurrency;
        return (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayPolicyNumber(f.policyNumber)}
              </p>
              <p className="text-xs text-gray-400">
                {claimCurrency ? `${claimCurrency} ` : ''}
                {fmtNum(outstanding)} outstanding
              </p>
            </div>
            {rowNeedsRate && (
              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
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
            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
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
        <Controller
          name="amount"
          control={control}
          rules={{ min: { value: 0.01, message: 'Amount is required' } }}
          render={({ field }) => (
            <NumberField
              label="Amount"
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.amount?.message}
              placeholder="0.00"
            />
          )}
        />
        {totalExpectedHint}
      </div>
      {allocationSection}
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
          />
        )}
      />

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
        <Controller
          name="amount"
          control={control}
          rules={{ min: { value: 0.01, message: 'Amount is required' } }}
          render={({ field }) => (
            <NumberField
              label="Amount"
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.amount?.message}
              placeholder="0.00"
            />
          )}
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
      rules={{ validate: (v) => v.length > 0 || 'Select at least one claim' }}
      render={({ field }) => (
        <MultiSelect
          label="Business"
          placeholder="Select claims…"
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

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
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
