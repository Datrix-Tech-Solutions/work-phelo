'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { cn, inputClass } from '@/lib/utils';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { Facultative } from '@/types/reinsurance';

export interface MakeClaimFormValues {
  estimatedLossAmount: string;
  finalLossAmount: string;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails: string;
}

const today = new Date().toISOString().split('T')[0];

export const MAKE_CLAIM_DEFAULTS: MakeClaimFormValues = {
  estimatedLossAmount: '',
  finalLossAmount: '',
  occurrenceDate: '',
  reportedDate: today,
  claimCause: '',
  occurrenceDetails: '',
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
}

export function MakeClaimFormFields({ form, placement }: MakeClaimFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-5">
      <ReadOnlyField label="Policy Number" value={placement.policyNumber ?? placement.reference} />
      <ReadOnlyField label="Cedant" value={placement.cedant.name} />
      {placement.classOfBusiness && (
        <ReadOnlyField label="Class of Business" value={placement.classOfBusiness} />
      )}

      <ReadOnlyField label="Currency" value={placement.currency ?? '—'} />

      <hr className="border-gray-100" />

      <FormField
        label="Estimated Loss Amount"
        registration={register('estimatedLossAmount', {
          required: 'Estimated loss amount is required',
          min: { value: 0.01, message: 'Estimated loss amount must be greater than zero' },
        })}
        placeholder="0.00"
        type="number"
        step="0.01"
        error={errors.estimatedLossAmount}
      />

      <FormField
        label="Final Loss Amount (optional)"
        registration={register('finalLossAmount', {
          min: { value: 0.01, message: 'Final loss amount must be greater than zero' },
        })}
        placeholder="0.00"
        type="number"
        step="0.01"
        error={errors.finalLossAmount}
      />

      <Controller
        name="occurrenceDate"
        control={control}
        rules={{ required: 'Occurrence date is required' }}
        render={({ field }) => (
          <DatePicker
            label="Occurrence Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.occurrenceDate?.message}
            disableFuture
          />
        )}
      />

      <Controller
        name="reportedDate"
        control={control}
        rules={{ required: 'Reported date is required' }}
        render={({ field }) => (
          <DatePicker
            label="Reported Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.reportedDate?.message}
            disableFuture
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Claim Cause</label>
        <textarea
          {...register('claimCause', {
            required: 'Claim cause is required',
            maxLength: { value: 250, message: 'Claim cause must be 250 characters or fewer' },
          })}
          placeholder="e.g. Warehouse fire"
          rows={3}
          className={cn(inputClass(), 'resize-none')}
        />
        {errors.claimCause && <p className="text-xs text-red-500">{errors.claimCause.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Occurrence Details (optional)</label>
        <textarea
          {...register('occurrenceDetails', {
            maxLength: {
              value: 2000,
              message: 'Occurrence details must be 2,000 characters or fewer',
            },
          })}
          placeholder="Add any useful loss-event details…"
          rows={4}
          className={cn(inputClass(), 'resize-none')}
        />
        {errors.occurrenceDetails && (
          <p className="text-xs text-red-500">{errors.occurrenceDetails.message}</p>
        )}
      </div>
    </div>
  );
}
