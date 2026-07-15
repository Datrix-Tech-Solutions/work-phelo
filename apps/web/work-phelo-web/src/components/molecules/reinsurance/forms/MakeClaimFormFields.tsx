'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { cn, inputClass } from '@/lib/utils';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCurrencyOptions } from '@/hooks';
import { Facultative } from '@/types/reinsurance';

export interface MakeClaimFormValues {
  estimatedLossAmount: string;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails: string;
  currency: string;
}

export const MAKE_CLAIM_DEFAULTS: MakeClaimFormValues = {
  estimatedLossAmount: '',
  occurrenceDate: '',
  reportedDate: '',
  claimCause: '',
  occurrenceDetails: '',
  currency: '',
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

interface MakeClaimFormFieldsProps {
  form: UseFormReturn<MakeClaimFormValues>;
  placement: Facultative;
  /** Skip the read-only Policy Number/Cedant/Class of Business rows — use when
   * that info is already shown by the caller's own placement picker. */
  hidePlacementInfo?: boolean;
}

export function MakeClaimFormFields({
  form,
  placement,
  hidePlacementInfo,
}: MakeClaimFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const { data: currencyOptions = [] } = useCurrencyOptions();

  return (
    <div className="flex flex-col gap-5">
      {!hidePlacementInfo && (
        <>
          <ReadOnlyField
            label="Policy Number"
            value={placement.policyNumber ?? placement.reference}
          />
          <ReadOnlyField label="Cedant" value={placement.cedant.name} />
          {placement.classOfBusiness && (
            <ReadOnlyField label="Class of Business" value={placement.classOfBusiness} />
          )}

          <hr className="border-gray-100" />
        </>
      )}

      <FormField
        label="Estimated Loss Amount"
        registration={register('estimatedLossAmount', {
          required: 'Estimated loss amount is required',
          validate: (value) => {
            const amount = parseFloat(value);
            if (placement.sumInsured != null && amount > placement.sumInsured) {
              return `Estimated loss amount cannot exceed the sum insured (${placement.sumInsured.toLocaleString()})`;
            }
            return true;
          },
        })}
        placeholder="0.00"
        type="number"
        step="any"
        error={errors.estimatedLossAmount}
      />

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

      <Controller
        name="occurrenceDate"
        control={control}
        rules={{
          required: 'Occurrence date is required',
          validate: (value) => {
            const date = new Date(value);
            if (placement.inceptionDate && date < new Date(placement.inceptionDate)) {
              return `Occurrence date cannot be before the inception date (${new Date(placement.inceptionDate).toLocaleDateString()})`;
            }
            if (placement.expiryDate && date > new Date(placement.expiryDate)) {
              return `Occurrence date cannot be after the end date (${new Date(placement.expiryDate).toLocaleDateString()})`;
            }
            return true;
          },
        }}
        render={({ field }) => (
          <DatePicker
            label="Occurrence Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.occurrenceDate?.message}
          />
        )}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Claim Details</label>
        <textarea
          {...register('claimCause', { required: 'Claim cause is required' })}
          placeholder="Describe the cause of the claim…"
          rows={3}
          className={cn(inputClass(), 'resize-none')}
        />
        {errors.claimCause && <p className="text-xs text-red-500">{errors.claimCause.message}</p>}
      </div>
    </div>
  );
}
