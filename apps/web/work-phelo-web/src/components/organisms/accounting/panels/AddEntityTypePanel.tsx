'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { useCreateEntityType, useUpdateEntityType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { EntityType } from '@/types/accounting';

interface AddEntityTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing type instead of creating one. */
  entityType?: EntityType | null;
}

type FormValues = {
  name: string;
};

const DEFAULTS: FormValues = { name: '' };

export function AddEntityTypePanel({ isOpen, onClose, entityType }: AddEntityTypePanelProps) {
  const isEditing = !!entityType;
  const toast = useToast();
  const { mutateAsync: createEntityType, isPending: isCreating } = useCreateEntityType();
  const { mutateAsync: updateEntityType, isPending: isUpdating } = useUpdateEntityType();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset(entityType ? { name: entityType.name } : DEFAULTS);
  }, [isOpen, entityType, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (entityType) {
        await updateEntityType({ id: entityType.id, name: values.name });
        toast.success('Type updated successfully');
      } else {
        await createEntityType({ name: values.name });
        toast.success('Type created successfully');
      }
      handleClose();
    } catch (error) {
      toast.error(extractError(error, `Failed to ${isEditing ? 'update' : 'create'} type`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Update Type' : 'Add Type'}
      description="Define a new entity type available in the Type field."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add Type'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Name"
          registration={register('name', { required: 'Name is required' })}
          error={errors.name}
          placeholder="e.g. Supplier"
        />
      </div>
    </SidePanel>
  );
}
