'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FacultativeFormValues } from '@/types/reinsurance';
import { useCedantOptions, useRiskTypeOptions, useCurrencyOptions } from '@/hooks';

interface FacultativeFormFieldsProps {
  form: UseFormReturn<FacultativeFormValues>;
}

export default function FacultativeFormFields({ form }: FacultativeFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const periodFrom = watch('periodFrom');

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  return (
    <div className="flex flex-col gap-7">
      {/* ── Policy Details ── */}
      <FormSection title="Policy Details">
        <div className="flex flex-col gap-5">
          <Controller
            name="insuranceCompany"
            control={control}
            rules={{ required: 'Insurance company is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Insurance Company"
                placeholder="Select insurance company…"
                value={field.value}
                onChange={field.onChange}
                error={errors.insuranceCompany?.message}
                options={cedantOptions}
              />
            )}
          />

          <Controller
            name="riskType"
            control={control}
            rules={{ required: 'Risk type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Risk Type"
                placeholder="Type to search risk type…"
                value={field.value}
                onChange={field.onChange}
                error={errors.riskType?.message}
                options={riskTypeOptions}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Offer Details ── */}
      <FormSection title="Offer Details">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Policy No."
              registration={register('policyNo', { required: 'Policy number is required' })}
              error={errors.policyNo}
              placeholder="e.g. POL-2024-001"
            />

            <FormField
              label="Insured"
              registration={register('insured', { required: 'Insured is required' })}
              error={errors.insured}
              placeholder="e.g. Accra Breweries Ltd"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Sum Insured"
              type="number"
              registration={register('sumInsured', {
                required: 'Sum insured is required',
                min: { value: 0, message: 'Cannot be negative' },
                valueAsNumber: true,
              })}
              error={errors.sumInsured}
              placeholder="e.g. 5000000"
            />

            <FormField
              label="Rate (%)"
              type="number"
              registration={register('rate', {
                required: 'Rate is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.rate}
              placeholder="e.g. 1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Premium"
              type="number"
              registration={register('premium', {
                required: 'Premium is required',
                min: { value: 0, message: 'Cannot be negative' },
                valueAsNumber: true,
              })}
              error={errors.premium}
              placeholder="e.g. 75000"
            />

            <FormField
              label="Facultative Offer (%)"
              type="number"
              registration={register('facultativeOffer', {
                required: 'Facultative offer is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.facultativeOffer}
              placeholder="e.g. 60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Commission (%)"
              type="number"
              registration={register('commission', {
                required: 'Commission is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.commission}
              placeholder="e.g. 15"
            />

            <FormField
              label="Preliminary Brokerage (%)"
              type="number"
              registration={register('preliminaryBrokerage', {
                required: 'Preliminary brokerage is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.preliminaryBrokerage}
              placeholder="e.g. 5"
            />
          </div>

          <Controller
            name="currency"
            control={control}
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Currency"
                placeholder="Select currency…"
                value={field.value}
                onChange={field.onChange}
                error={errors.currency?.message}
                options={currencyOptions}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Period of Insurance ── */}
      <FormSection title="Period of Insurance">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="periodFrom"
            control={control}
            rules={{ required: 'Start date is required' }}
            render={({ field }) => (
              <DatePicker
                label="From"
                value={field.value}
                onChange={field.onChange}
                error={errors.periodFrom?.message}
              />
            )}
          />

          <Controller
            name="periodTo"
            control={control}
            rules={{ required: 'End date is required' }}
            render={({ field }) => (
              <DatePicker
                label="To"
                value={field.value}
                onChange={field.onChange}
                minDate={periodFrom || undefined}
                error={errors.periodTo?.message}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Comment ── */}
      <FormSection title="Comment">
        <FormField
          label="Comment"
          type="textarea"
          rows={4}
          registration={register('comment')}
          error={errors.comment}
          placeholder="Add any relevant notes or comments…"
        />
      </FormSection>
    </div>
  );
}
