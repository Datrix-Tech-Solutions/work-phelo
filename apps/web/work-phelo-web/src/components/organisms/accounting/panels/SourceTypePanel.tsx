'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateSourceType, useUpdateSourceType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { SourceTypeDefinition } from '@/types/accounting';

type FormValues = { name: string; description: string };
const DEFAULTS: FormValues = { name: '', description: '' };

export function SourceTypePanel({
  sourceType,
  onClose,
}: {
  sourceType: SourceTypeDefinition | null | undefined;
  onClose: () => void;
}) {
  const isEditing = sourceType !== null && sourceType !== undefined;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateSourceType();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateSourceType();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (sourceType) reset({ name: sourceType.name, description: sourceType.description ?? '' });
    else reset(DEFAULTS);
  }, [sourceType, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    try {
      const payload = { name: values.name, description: values.description || undefined };
      if (sourceType) await update({ id: sourceType.id, ...payload });
      else await create(payload);
      toast.success(
        isEditing ? 'Source type updated successfully' : 'Source type created successfully',
      );
      close();
    } catch (error) {
      toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} source type`));
    }
  };

  return (
    <SidePanel
      isOpen={sourceType !== undefined}
      onClose={close}
      title={isEditing ? 'Update Source Type' : 'Add Source Type'}
      description="Source types identify where a transaction originates from."
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
            {isEditing ? 'Save Changes' : 'Add Source Type'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Name"
          registration={register('name', {
            required: 'Name is required',
            maxLength: { value: 160, message: 'Name must be 160 characters or fewer' },
          })}
          error={errors.name}
          placeholder="e.g. Bank Feed"
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
