'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { FormField } from '@/components/molecules/shared/FormField';
import { PlacementSettlementMethod } from '@/types/reinsurance';

export type SettlementSource = {
  value: string;
  label: string;
  sublabel: string;
  closingId?: string;
  endorsementClosingId?: string;
  participantId?: string;
  amount: number;
  outstanding: number;
  currency: string;
};

export interface DisbursementFormValues {
  sourceId: string;
  settlementMethod: PlacementSettlementMethod;
  amount: string;
  paymentDate: string;
  reference: string;
  notes: string;
}

export const SETTLEMENT_METHODS: PlacementSettlementMethod[] = [
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'MOBILE_MONEY',
  'INTERNAL_OFFSET',
  'JOURNAL',
  'OTHER',
];

export const RECORD_DISBURSEMENT_DEFAULTS: DisbursementFormValues = {
  sourceId: '',
  settlementMethod: 'BANK_TRANSFER',
  amount: '',
  paymentDate: new Date().toISOString(),
  reference: '',
  notes: '',
};

interface RecordDisbursementFormFieldsProps {
  form: UseFormReturn<DisbursementFormValues>;
  sources: SettlementSource[];
}

export function RecordDisbursementFormFields({ form, sources }: RecordDisbursementFormFieldsProps) {
  const {
    control,
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <Controller
        name="sourceId"
        control={control}
        rules={{ required: 'Closing source is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Closing"
            placeholder="Select closing…"
            options={sources.map((source) => ({
              value: source.value,
              label: source.label,
              sublabel: source.sublabel,
            }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.sourceId?.message}
          />
        )}
      />
      <label className="space-y-1">
        <span className="block text-sm font-medium text-gray-700">Settlement Method</span>
        <select
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          {...register('settlementMethod', { required: 'Settlement method is required' })}
        >
          {SETTLEMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
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
        label="Reference"
        registration={register('reference')}
        placeholder="Bank reference…"
        error={errors.reference}
      />
      <FormField
        label="Notes"
        registration={register('notes')}
        placeholder="Payment notes…"
        error={errors.notes}
      />
    </>
  );
}
