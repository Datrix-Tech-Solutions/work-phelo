'use client';

import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { cn, inputClass } from '@/lib/utils';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCurrencyOptions, usePlacementEffectiveView } from '@/hooks';
import { Facultative } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

export interface MakeClaimFormValues {
  estimatedLossAmount: string;
  finalLossAmount: string;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails: string;
  currency: string;
}

export const MAKE_CLAIM_DEFAULTS: MakeClaimFormValues = {
  estimatedLossAmount: '',
  finalLossAmount: '',
  occurrenceDate: '',
  reportedDate: '',
  claimCause: '',
  occurrenceDetails: '',
  currency: '',
};

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

interface MakeClaimFormFieldsProps {
  form: UseFormReturn<MakeClaimFormValues>;
  placement: Facultative;
  /** Skip the read-only Policy Number/Cedant/Class of Business rows — use when
   * that info is already shown by the caller's own placement picker. */
  hidePlacementInfo?: boolean;
  /** Show the Actual Claim Amount field — only relevant once a claim already exists. */
  isEditing?: boolean;
}

export function MakeClaimFormFields({
  form,
  placement,
  hidePlacementInfo,
  isEditing,
}: MakeClaimFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const { data: currencyOptions = [] } = useCurrencyOptions();
  const occurrenceDate = useWatch({ control, name: 'occurrenceDate' });
  const effectiveAsOfDate = occurrenceDate ? new Date(occurrenceDate).toISOString() : undefined;
  const { data: effectiveView, isFetching: isLoadingEffectiveTerms } = usePlacementEffectiveView(
    placement.id,
    !!placement.id && !!effectiveAsOfDate,
    effectiveAsOfDate,
  );
  const effectiveTerms = effectiveView?.effectiveTerms;
  const effectiveSumInsured = effectiveTerms?.sumInsured ?? placement.sumInsured;
  const effectiveInceptionDate = effectiveTerms?.inceptionDate ?? placement.inceptionDate;
  const effectiveExpiryDate = effectiveTerms?.expiryDate ?? placement.expiryDate;
  const effectiveCurrency = effectiveTerms?.currency ?? placement.currency;

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {!hidePlacementInfo && (
        <>
          <ReadOnlyField
            label="Policy Number"
            value={displayPolicyNumber(placement.policyNumber)}
          />
          <ReadOnlyField label="Cedant" value={placement.cedant.name} />
          {placement.classOfBusiness && (
            <ReadOnlyField label="Class of Business" value={placement.classOfBusiness} />
          )}

          <hr className="border-gray-100" />
        </>
      )}

      <Controller
        name="estimatedLossAmount"
        control={control}
        rules={{
          min: { value: 0.01, message: 'Estimated loss amount is required' },
          validate: (value) => {
            const amount = parseFloat(value);
            if (effectiveSumInsured != null && amount > effectiveSumInsured) {
              return `Estimated loss amount cannot exceed the effective sum insured (${effectiveSumInsured.toLocaleString()})`;
            }
            return true;
          },
        }}
        render={({ field }) => (
          <NumberField
            label="Estimated Loss Amount"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(String(n))}
            error={errors.estimatedLossAmount?.message}
            placeholder="0.00"
          />
        )}
      />

      {isEditing && (
        <Controller
          name="finalLossAmount"
          control={control}
          rules={{
            validate: (value) => {
              if (!value || Number(value) === 0) return true;
              const amount = parseFloat(value);
              if (effectiveSumInsured != null && amount > effectiveSumInsured) {
                return `Actual claim amount cannot exceed the effective sum insured (${effectiveSumInsured.toLocaleString()})`;
              }
              return true;
            },
          }}
          render={({ field }) => (
            <NumberField
              label="Actual Claim Amount"
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.finalLossAmount?.message}
              placeholder="0.00"
            />
          )}
        />
      )}

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
            if (effectiveInceptionDate && date < new Date(effectiveInceptionDate)) {
              return `Occurrence date cannot be before the effective inception date (${new Date(effectiveInceptionDate).toLocaleDateString()})`;
            }
            if (effectiveExpiryDate && date > new Date(effectiveExpiryDate)) {
              return `Occurrence date cannot be after the effective end date (${new Date(effectiveExpiryDate).toLocaleDateString()})`;
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
      {occurrenceDate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          <p className="font-semibold">Effective claim context</p>
          <p className="mt-1">
            {isLoadingEffectiveTerms
              ? 'Loading effective terms for this loss date…'
              : [
                  effectiveCurrency ? `Currency ${effectiveCurrency}` : null,
                  effectiveSumInsured != null
                    ? `Sum insured ${effectiveSumInsured.toLocaleString()}`
                    : null,
                  effectiveInceptionDate
                    ? `From ${new Date(effectiveInceptionDate).toLocaleDateString()}`
                    : null,
                  effectiveExpiryDate
                    ? `to ${new Date(effectiveExpiryDate).toLocaleDateString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No additional effective terms available.'}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
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
