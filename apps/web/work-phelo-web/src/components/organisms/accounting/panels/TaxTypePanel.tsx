'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormField } from '@/components/molecules/shared/FormField';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateTaxType, useUpdateTaxType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { TaxType } from '@/types/accounting';

type FormValues = {
  code: string;
  name: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string;
};
const DEFAULTS: FormValues = { code: '', name: '', rate: '', effectiveFrom: '', effectiveTo: '' };

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
      });
    else reset(DEFAULTS);
  }, [taxType, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    try {
      const payload = {
        code: values.code,
        name: values.name,
        rate: Number(values.rate),
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo || undefined,
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
      description="Tax types are picked by a rule's deduction lines to compute their amount automatically."
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
      <div className="flex flex-col gap-4">
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
        <div className="grid grid-cols-2 gap-3">
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
      </div>
    </SidePanel>
  );
}
