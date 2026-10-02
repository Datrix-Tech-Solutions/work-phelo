'use client';

import { useEffect } from 'react';
import { Controller, useWatch, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  JournalEntryFormValues,
  RECURRENCE_FREQUENCY_OPTIONS,
  RECURRING_ON_GENERATION_OPTIONS,
  RecurrenceEndType,
} from '@/types/accounting';
import { calculateNextRunDate } from '@/lib/accounting/recurrence';
import { inputClass } from '@/lib/utils';

const END_TYPE_OPTIONS: { value: RecurrenceEndType; label: string }[] = [
  { value: 'NEVER', label: 'Never' },
  { value: 'ON_DATE', label: 'On a date' },
];

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface RecurringEntryDetailsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function RecurringEntryDetailsSection({ form }: RecurringEntryDetailsSectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const frequency = useWatch({ control, name: 'frequency' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endType = useWatch({ control, name: 'endType' });
  const nextRunDate = useWatch({ control, name: 'nextRunDate' });

  useEffect(() => {
    setValue('nextRunDate', startDate ? calculateNextRunDate(startDate, frequency) : '');
  }, [startDate, frequency, setValue]);

  useEffect(() => {
    if (endType === 'NEVER') setValue('endDate', '');
  }, [endType, setValue]);

  return (
    <FormSection title="Recurring Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          label="Name"
          registration={register('recurringName', { required: 'Name is required' })}
          error={errors.recurringName}
          placeholder="e.g. Monthly office rent"
        />

        <Controller
          name="frequency"
          control={control}
          rules={{ required: 'Frequency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Frequency"
              placeholder="Select frequency…"
              options={RECURRENCE_FREQUENCY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              clearable={false}
              error={errors.frequency?.message}
            />
          )}
        />

        <Controller
          name="onGeneration"
          control={control}
          rules={{ required: 'Select what happens on generation' }}
          render={({ field }) => (
            <SearchSelect
              label="On Generation"
              placeholder="Select…"
              options={RECURRING_ON_GENERATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              clearable={false}
              error={errors.onGeneration?.message}
            />
          )}
        />

        <Controller
          name="startDate"
          control={control}
          rules={{ required: 'Start date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Start Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.startDate?.message}
            />
          )}
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <Controller
            name="endType"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="End"
                options={END_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                clearable={false}
              />
            )}
          />
        </div>

        {endType === 'ON_DATE' && (
          <Controller
            name="endDate"
            control={control}
            rules={{
              required: 'End date is required',
              validate: (value) =>
                !startDate ||
                !value ||
                value >= startDate ||
                'End date must be after the start date',
            }}
            render={({ field }) => (
              <DatePicker
                label="End Date"
                value={field.value}
                onChange={field.onChange}
                minDate={startDate || undefined}
                error={errors.endDate?.message}
              />
            )}
          />
        )}

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <span className="text-sm font-medium text-gray-700">Next Run Date</span>
          <div className={inputClass(undefined, 'py-2 text-sm bg-gray-50 text-gray-500')}>
            {nextRunDate ? fmtDate(nextRunDate) : 'Set a start date'}
          </div>
        </div>
      </div>

      <FormField
        label="Memo"
        type="textarea"
        rows={3}
        registration={register('description', { required: 'Memo is required' })}
        error={errors.description}
        placeholder="Provide a brief description of this recurring entry…"
      />
    </FormSection>
  );
}
