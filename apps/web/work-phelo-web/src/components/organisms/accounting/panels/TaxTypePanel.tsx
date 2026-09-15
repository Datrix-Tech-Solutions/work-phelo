'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateTaxType, useUpdateTaxType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { TaxType } from '@/types/accounting';

type FormValues = { name: string; rate: string; description: string };
const DEFAULTS: FormValues = { name: '', rate: '', description: '' };

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
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (taxType)
      reset({
        name: taxType.name,
        rate: String(taxType.rate),
        description: taxType.description ?? '',
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
        name: values.name,
        rate: Number(values.rate),
        description: values.description || undefined,
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
      description="Tax types are picked by a rule's tax lines to compute their amount automatically."
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
          label="Name"
          registration={register('name', {
            required: 'Name is required',
            maxLength: { value: 80, message: 'Name must be 80 characters or fewer' },
          })}
          error={errors.name}
          placeholder="e.g. VAT"
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
        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', {
            maxLength: { value: 500, message: 'Description must be 500 characters or fewer' },
          })}
          error={errors.description}
          placeholder="Optional description"
        />
      </div>
    </SidePanel>
  );
}
