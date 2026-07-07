'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { JournalEntryFormValues } from '@/types/accounting';
import { useAccountingCurrencyOptions } from '@/hooks';

interface JournalEntryDetailsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function JournalEntryDetailsSection({ form }: JournalEntryDetailsSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const { options: currencyOptions } = useAccountingCurrencyOptions();

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Controller
          name="transactionDate"
          control={control}
          rules={{ required: 'Transaction date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Transaction Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.transactionDate?.message}
            />
          )}
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

        <FormField
          label="Reference Number"
          registration={register('reference', { required: 'Reference is required' })}
          error={errors.reference}
          placeholder="e.g. JE-2025-001"
        />
      </div>

      <FormField
        label="Description"
        type="textarea"
        rows={3}
        registration={register('description')}
        error={errors.description}
        placeholder="Provide a brief description of this journal entry…"
      />
    </FormSection>
  );
}
