'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateTaxType, useGLAccountOptions, useUpdateTaxType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { DEFAULT_REMINDER_DAYS, ordinal, REMINDER_DAY_OPTIONS } from '@/lib/payroll-groups';
import type { TaxPayFrequency, TaxType } from '@/types/accounting';

type FormValues = {
  code: string;
  name: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string;
  payableAccountId: string;
  receivableAccountId: string;
  reminderEnabled: boolean;
  reminderFrequency: TaxPayFrequency;
  /** '1' to '28', or 'last' for the last day of the month. */
  reminderDue: string;
  reminderDaysBefore: string;
};

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Every quarter' },
  { value: 'YEARLY', label: 'Yearly' },
];
const DUE_OPTIONS = [
  ...Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `${ordinal(i + 1)} of the month`,
  })),
  { value: 'last', label: 'Last day of the month' },
];
const DEFAULTS: FormValues = {
  code: '',
  name: '',
  rate: '',
  effectiveFrom: '',
  effectiveTo: '',
  payableAccountId: '',
  receivableAccountId: '',
  reminderEnabled: false,
  reminderFrequency: 'MONTHLY',
  reminderDue: 'last',
  reminderDaysBefore: String(DEFAULT_REMINDER_DAYS),
};

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function TaxTypePanel({
  taxType,
  onClose,
}: {
  taxType: TaxType | null | undefined;
  onClose: () => void;
}) {
  const isEditing = taxType !== null && taxType !== undefined;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateTaxType();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateTaxType();
  const { options: accountOptions, isLoading: isLoadingAccounts } = useGLAccountOptions();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (taxType)
      reset({
        code: taxType.code,
        name: taxType.name,
        rate: String(taxType.rate),
        effectiveFrom: toDateInput(taxType.effectiveFrom),
        effectiveTo: toDateInput(taxType.effectiveTo),
        payableAccountId: taxType.payableAccountId ?? '',
        receivableAccountId: taxType.receivableAccountId ?? '',
        reminderEnabled: taxType.reminderEnabled,
        reminderFrequency: taxType.reminderFrequency,
        reminderDue: taxType.reminderDueOnLastDay
          ? 'last'
          : String(taxType.reminderDueDay ?? 'last'),
        reminderDaysBefore: String(taxType.reminderDaysBefore),
      });
    else reset(DEFAULTS);
  }, [taxType, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const reminderEnabled = useWatch({ control, name: 'reminderEnabled' });
  const payableAccountId = useWatch({ control, name: 'payableAccountId' });

  const submit = async (values: FormValues) => {
    if (values.reminderEnabled && !values.payableAccountId) {
      toast.error('Choose the purchase tax account to turn on the payment reminder');
      return;
    }
    try {
      const payload = {
        code: values.code,
        name: values.name,
        rate: Number(values.rate),
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo || undefined,
        // Sent as null when cleared, so an edit can remove a default.
        payableAccountId: values.payableAccountId || null,
        receivableAccountId: values.receivableAccountId || null,
        reminderEnabled: values.reminderEnabled,
        reminderFrequency: values.reminderFrequency,
        reminderDueOnLastDay: values.reminderDue === 'last',
        reminderDueDay: values.reminderDue === 'last' ? null : Number(values.reminderDue),
        reminderDaysBefore: Number(values.reminderDaysBefore),
      };
      if (taxType) await update({ id: taxType.id, ...payload });
      else await create(payload);
      toast.success(isEditing ? 'Tax type updated successfully' : 'Tax type created successfully');
      close();
    } catch (error) {
      toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} tax type`));
    }
  };

  return (
    <SidePanel
      isOpen={taxType !== undefined}
      onClose={close}
      title={isEditing ? 'Update Tax Type' : 'Add Tax Type'}
      description="A tax type is picked on a bill, invoice or payment, and its amount is worked out from the rate."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isCreating || isUpdating}>
            Cancel
          </Button>
          <Button
            isLoading={isCreating || isUpdating}
            loadingText="Saving…"
            onClick={handleSubmit(submit)}
          >
            {isEditing ? 'Save Changes' : 'Add Tax Type'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <FormField
            label="Code"
            registration={register('code', {
              required: 'Code is required',
              maxLength: { value: 30, message: 'Code must be 30 characters or fewer' },
              setValueAs: (value: string) => value.toUpperCase(),
            })}
            error={errors.code}
            placeholder="e.g. VAT"
          />
          <FormField
            label="Name"
            registration={register('name', {
              required: 'Name is required',
              maxLength: { value: 80, message: 'Name must be 80 characters or fewer' },
            })}
            error={errors.name}
            placeholder="e.g. Value Added Tax"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="Rate (%)"
            type="number"
            step="0.001"
            registration={register('rate', {
              required: 'Rate is required',
              min: { value: 0, message: 'Rate cannot be negative' },
              max: { value: 100, message: 'Rate cannot exceed 100' },
            })}
            error={errors.rate}
            placeholder="e.g. 12.5"
          />
          <Controller
            name="effectiveFrom"
            control={control}
            rules={{ required: 'Effective from is required' }}
            render={({ field }) => (
              <DatePicker
                label="Effective From"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveFrom?.message}
              />
            )}
          />
          <Controller
            name="effectiveTo"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Effective To"
                placeholder="Open-ended"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveTo?.message}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Controller
            name="payableAccountId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Purchase Tax Account (optional)"
                placeholder={isLoadingAccounts ? 'Loading…' : 'e.g. Input VAT, Tax Payable'}
                options={accountOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="receivableAccountId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Sales Tax Account (optional)"
                placeholder={isLoadingAccounts ? 'Loading…' : 'e.g. Output VAT, Tax Receivable'}
                options={accountOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <p className="-mt-1 text-xs text-gray-500">
          These pre-fill the account when this tax is added to a bill, an invoice or a payment. The
          user can still pick a different one there.
        </p>

        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
          <Controller
            name="reminderEnabled"
            control={control}
            render={({ field }) => (
              <ToggleRow
                label="Payment reminder"
                description="Reminds the people who pay taxes, until what is owed has been paid."
                enabled={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {reminderEnabled && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Controller
                  name="reminderFrequency"
                  control={control}
                  render={({ field }) => (
                    <SearchSelect
                      label="Paid"
                      clearable={false}
                      options={FREQUENCY_OPTIONS}
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                    />
                  )}
                />
                <Controller
                  name="reminderDue"
                  control={control}
                  render={({ field }) => (
                    <SearchSelect
                      label="Due, the month after"
                      clearable={false}
                      options={DUE_OPTIONS}
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                    />
                  )}
                />
              </div>
              <Controller
                name="reminderDaysBefore"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    label="Remind"
                    clearable={false}
                    options={REMINDER_DAY_OPTIONS.map((d) => ({
                      value: String(d),
                      label: d === 1 ? '1 day before it is due' : `${d} days before it is due`,
                    }))}
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                  />
                )}
              />
              <p className="text-xs text-gray-500">
                What is owed is read from the purchase tax account above, so a payment is counted
                however it was booked, and the reminder stops once it has been paid.
              </p>
              {!payableAccountId && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Choose the purchase tax account above for this reminder to work.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
