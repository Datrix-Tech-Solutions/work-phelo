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
import {
  fetchPlacementFinancialPosition,
  fetchPlacementPayments,
  paymentsKey,
  placementFinancialPositionKey,
} from '@/hooks/reinsurance/usePayments';
import { cn } from '@/lib/utils';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  cedantPaymentStatusFromPosition,
  pendingPremiumReceived,
  CedantPaymentStatus,
} from '@/lib/reinsurance/placementStatus';
import { PlacementPayment } from '@/types/reinsurance';

const PAYMENT_STATUS_CLASS: Record<CedantPaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  Pending: 'text-xs text-amber-600 font-medium',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

export interface AddPaymentFormValues {
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

export const ADD_PAYMENT_DEFAULTS: AddPaymentFormValues = {
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
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
  const selectedFacultatives = useMemo(
    () => facultatives.filter((f) => businessIds.includes(f.id)),
    [facultatives, businessIds],
  );

  const positionQueries = useQueries({
    queries: selectedFacultatives.map((f) => ({
      queryKey: placementFinancialPositionKey(f.id),
      queryFn: () => fetchPlacementFinancialPosition(f.id),
    })),
  });

  const positionByPlacementId = useMemo(() => {
    const map = new Map<string, (typeof positionQueries)[number]['data']>();
    selectedFacultatives.forEach((f, index) => {
      const position = positionQueries[index]?.data;
      if (position) map.set(f.id, position);
    });
    return map;
  }, [selectedFacultatives, positionQueries]);

  // For the payment-status summary below the business picker — same authoritative figures
  // (financial position + pending receipts) the Premiums page and placement Details page use.
  const paymentsQueries = useQueries({
    queries: selectedFacultatives.map((f) => ({
      queryKey: paymentsKey(f.id),
      queryFn: () => fetchPlacementPayments(f.id),
    })),
  });

  const paymentsByPlacementId = useMemo(() => {
    const map = new Map<string, PlacementPayment[]>();
    selectedFacultatives.forEach((f, index) => {
      const payments = paymentsQueries[index]?.data;
      if (payments) map.set(f.id, payments);
    });
    return map;
  }, [selectedFacultatives, paymentsQueries]);

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
          const parts = [f.classOfBusiness, f.title].filter(Boolean);
          return {
            value: f.id,
            label: `${displayPolicyNumber(f.policyNumber)} · ${f.title}`,
            sublabel: parts.join(' · '),
          };
        }),
    [facultatives, cedantId],
  );

  const totalExpected = useMemo(() => {
    return selectedFacultatives.reduce((sum, f) => {
      const outstanding = positionByPlacementId.get(f.id)?.cedant.outstanding;
      return sum + Math.max(0, outstanding ?? 0);
    }, 0);
  }, [selectedFacultatives, positionByPlacementId]);

  const expectedCurrency = useMemo(
    () =>
      selectedFacultatives
        .map((f) => positionByPlacementId.get(f.id)?.currency ?? f.currency)
        .find(Boolean) ?? null,
    [selectedFacultatives, positionByPlacementId],
  );

  const paymentType = watch('paymentType');
  const paymentCurrency = watch('currency');
  const amountValue = watch('amount');
  const allocations = useWatch({ control, name: 'allocations' });

  const parsedAmount = parseFloat(amountValue) || 0;

  const allSameCurrency = useMemo(() => {
    if (selectedFacultatives.length <= 1) return true;
    const first =
      positionByPlacementId.get(selectedFacultatives[0].id)?.currency ??
      selectedFacultatives[0].currency;
    return selectedFacultatives.every(
      (f) => (positionByPlacementId.get(f.id)?.currency ?? f.currency) === first,
    );
  }, [selectedFacultatives, positionByPlacementId]);

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
      const netPremium = Math.max(0, positionByPlacementId.get(f.id)?.cedant.outstanding ?? 0);
      const proportion =
        totalExpected > 0 ? netPremium / totalExpected : 1 / selectedFacultatives.length;
      newAllocations[f.id] = (proportion * parsedAmount).toFixed(2);
    });
    setValue('allocations', newAllocations);
  }, [
    parsedAmount,
    positionByPlacementId,
    selectedFacultatives,
    setValue,
    showAllocation,
    totalExpected,
  ]);

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
        Outstanding total:{' '}
        <span className="font-medium text-gray-700">
          {expectedCurrency ? `${expectedCurrency} ` : ''}
          {totalExpected.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </p>
    ) : null;

  // Whether payment has already been made (and how much is left) for each selected business —
  // shown as soon as a business is picked, ahead of everything else, so it's answered before
  // the user has to fill in an amount at all.
  const businessPaymentSummary = selectedFacultatives.length > 0 && (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      {selectedFacultatives.map((f) => {
        const position = positionByPlacementId.get(f.id);
        const payments = paymentsByPlacementId.get(f.id) ?? [];
        const due = position?.cedant.currentObligation ?? 0;
        const paid = position?.cedant.netSettled ?? 0;
        const outstanding = position?.cedant.outstanding ?? 0;
        const pending = pendingPremiumReceived(payments);
        const status = cedantPaymentStatusFromPosition(due, paid, outstanding, pending);
        const cur = position?.currency ?? f.currency ?? '';

        return (
          <div key={f.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayPolicyNumber(f.policyNumber)}
              </p>
              <span className={PAYMENT_STATUS_CLASS[status]}>{status}</span>
            </div>
            <span className="text-xs text-gray-700 font-medium whitespace-nowrap text-right">
              {outstanding > 0.0001 ? `${cur} ${fmtNum(outstanding)} left` : 'Fully paid'}
            </span>
          </div>
        );
      })}
    </div>
  );

  const allocationSection = showAllocation && (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-xs font-semibold text-gray-700">Allocate Payment</p>
      {selectedFacultatives.map((f) => {
        const netPremium = Math.max(0, positionByPlacementId.get(f.id)?.cedant.outstanding ?? 0);
        const rowNeedsRate =
          !allSameCurrency && !!paymentCurrency && !!f.currency && paymentCurrency !== f.currency;
        return (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayPolicyNumber(f.policyNumber)}
              </p>
              <p className="text-xs text-gray-400">
                {f.currency ? `${f.currency} ` : ''}
                {fmtNum(netPremium)} due
              </p>
            </div>
            {rowNeedsRate && (
              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <span className="text-xs text-gray-400">Rate</span>
                <Controller
                  name={`allocationRates.${f.id}` as `allocationRates.${string}`}
                  control={control}
                  render={({ field }) => (
                    <NumberField
                      value={field.value ? Number(field.value) : 0}
                      onChange={(n) => field.onChange(n ? String(n) : '')}
                      placeholder="0.00"
                      className="w-20 px-2 py-2 text-xs text-right"
                    />
                  )}
                />
              </div>
            )}
            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <span className="text-xs text-gray-400">Amount</span>
              <Controller
                name={`allocations.${f.id}` as `allocations.${string}`}
                control={control}
                render={({ field }) => (
                  <NumberField
                    value={field.value ? Number(field.value) : 0}
                    onChange={(n) => field.onChange(n ? String(n) : '')}
                    placeholder="0.00"
                    className="w-32 px-2 py-2 text-xs text-right"
                  />
                )}
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

  const bankNameField = (
    <FormField
      label="Bank Name"
      registration={register('bankName', { required: 'Bank name is required' })}
      placeholder="Enter bank name…"
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

      {bankNameField}

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

      {bankNameField}

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
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <ReadOnlyField label="Cedant" value={preFilledPlacement.cedant.name} />
        <ReadOnlyField
          label="Business"
          value={displayPolicyNumber(preFilledPlacement.policyNumber)}
        />
        {businessPaymentSummary}
        {paymentTypeField}
        {chequeFields}
        {bankFields}
      </div>
    );
  }

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
      {businessPaymentSummary}
      {businessIds.length > 0 && paymentTypeField}
      {chequeFields}
      {bankFields}
    </div>
  );
}
