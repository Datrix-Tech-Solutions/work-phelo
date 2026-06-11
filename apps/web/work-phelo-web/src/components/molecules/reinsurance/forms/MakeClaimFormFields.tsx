'use client';

import { useMemo } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCurrencyOptions } from '@/hooks';
import { Facultative } from '@/types/reinsurance';

export interface MakeClaimFormValues {
  claimAmount: string;
  claimDate: string;
  currency: string;
  rate: string;
}

export const MAKE_CLAIM_DEFAULTS: MakeClaimFormValues = {
  claimAmount: '',
  claimDate: '',
  currency: '',
  rate: '',
};

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

function fmtAmount(val: number, currency?: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MakeClaimFormFieldsProps {
  form: UseFormReturn<MakeClaimFormValues>;
  placement: Facultative;
}

export function MakeClaimFormFields({ form, placement }: MakeClaimFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const { data: currencyOptions = [] } = useCurrencyOptions();

  const claimablAmount = useMemo(() => {
    const facPremium =
      placement.premium != null && placement.facultativeOffer != null
        ? (placement.facultativeOffer / 100) * placement.premium
        : 0;
    return placement.commission != null
      ? facPremium * (1 - placement.commission / 100)
      : facPremium;
  }, [placement]);

  const selectedCurrency = watch('currency');
  const showRate =
    !!selectedCurrency && !!placement.currency && selectedCurrency !== placement.currency;

  return (
    <div className="flex flex-col gap-5">
      <ReadOnlyField label="Policy Number" value={placement.policyNumber ?? placement.reference} />
      <ReadOnlyField label="Cedant" value={placement.cedant.name} />
      {placement.classOfBusiness && (
        <ReadOnlyField label="Class of Business" value={placement.classOfBusiness} />
      )}

      <ReadOnlyField
        label="Claimable Amount"
        value={fmtAmount(claimablAmount, placement.currency)}
      />

      <hr className="border-gray-100" />

      <FormField
        label="Claim Amount"
        registration={register('claimAmount', { required: 'Claim amount is required' })}
        placeholder="0.00"
        type="number"
        step="any"
        error={errors.claimAmount}
      />

      <Controller
        name="claimDate"
        control={control}
        rules={{ required: 'Claim date is required' }}
        render={({ field }) => (
          <DatePicker
            label="Claim Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.claimDate?.message}
          />
        )}
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
    </div>
  );
}
