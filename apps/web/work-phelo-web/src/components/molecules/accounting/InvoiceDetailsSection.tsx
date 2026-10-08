'use client';

import { useMemo } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { AccountingTradeSide, InvoiceFormValues, SubledgerAccount } from '@/types/accounting';
import { useAccountingCurrencyOptions, useTransactionTypes } from '@/hooks';

interface InvoiceDetailsSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
  vendorLabel?: string;
  /** Real customer/vendor records to pick from — the backend keys invoices/bills
   * to a party id, not a free-text name. */
  parties: SubledgerAccount[];
  partyOptions: SearchSelectOption[];
  isLoadingParties?: boolean;
  side: AccountingTradeSide;
}

export function InvoiceDetailsSection({
  form,
  vendorLabel = 'Vendor',
  parties,
  partyOptions,
  isLoadingParties,
  side,
}: InvoiceDetailsSectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: transactionTypes = [] } = useTransactionTypes();

  const transactionTypeOptions: SearchSelectOption[] = useMemo(
    () =>
      transactionTypes
        .filter((t) => t.category === side && t.rulesCount > 0)
        .map((t) => ({ value: t.id, label: t.name })),
    [transactionTypes, side],
  );

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Controller
          name="vendor"
          control={control}
          rules={{ required: `${vendorLabel} is required` }}
          render={({ field }) => (
            <SearchSelect
              label={vendorLabel}
              placeholder={isLoadingParties ? 'Loading…' : `Select ${vendorLabel.toLowerCase()}…`}
              options={partyOptions}
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                const party = parties.find((p) => p.id === value);
                if (party?.currency) setValue('currency', party.currency);
              }}
              error={errors.vendor?.message}
            />
          )}
        />

        <FormField
          label="Reference Number"
          registration={register('invoiceNumber')}
          error={errors.invoiceNumber}
          placeholder="Optional — the posted document number is generated automatically"
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="transactionTypeId"
          control={control}
          rules={{ required: 'Transaction type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Transaction Type"
              placeholder={
                transactionTypeOptions.length === 0
                  ? 'No usable transaction types configured yet'
                  : 'Select a transaction type…'
              }
              options={transactionTypeOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.transactionTypeId?.message}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="invoiceDate"
          control={control}
          rules={{ required: 'Invoice date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Invoice Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.invoiceDate?.message}
            />
          )}
        />
        <Controller
          name="dueDate"
          control={control}
          rules={{ required: 'Due date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Due Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.dueDate?.message}
            />
          )}
        />
      </div>

      <FormField
        label="Description"
        type="textarea"
        rows={3}
        registration={register('description')}
        error={errors.description}
        placeholder="Provide a brief description of this invoice…"
      />
    </FormSection>
  );
}
