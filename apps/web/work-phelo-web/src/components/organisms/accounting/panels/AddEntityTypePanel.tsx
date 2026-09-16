'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { useCreateEntityType, useUpdateEntityType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { ENTITY_ACCOUNTING_RELATION_LABELS } from '@/types/accounting';
import type { EntityAccountingRelation, EntityType } from '@/types/accounting';

interface AddEntityTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing type instead of creating one. */
  entityType?: EntityType | null;
}

type FormValues = {
  name: string;
  accountingRelation: EntityAccountingRelation | '';
};

// No default relation — NONE is a real, selectable option, but a type left at NONE has
// no way to resolve a control account for its entities (entity creation has no manual
// control-account picker), so we don't want that to be the silent default.
const DEFAULTS: FormValues = { name: '', accountingRelation: '' };

const ACCOUNTING_RELATION_OPTIONS: SearchSelectOption[] = Object.entries(
  ENTITY_ACCOUNTING_RELATION_LABELS,
).map(([value, label]) => ({ value, label }));

export function AddEntityTypePanel({ isOpen, onClose, entityType }: AddEntityTypePanelProps) {
  const isEditing = !!entityType;
  const toast = useToast();
  const { mutateAsync: createEntityType, isPending: isCreating } = useCreateEntityType();
  const { mutateAsync: updateEntityType, isPending: isUpdating } = useUpdateEntityType();
  const isPending = isCreating || isUpdating;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      entityType
        ? { name: entityType.name, accountingRelation: entityType.accountingRelation }
        : DEFAULTS,
    );
  }, [isOpen, entityType, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const accountingRelation = values.accountingRelation as EntityAccountingRelation;
      if (entityType) {
        await updateEntityType({ id: entityType.id, name: values.name, accountingRelation });
        toast.success('Type updated successfully');
      } else {
        await createEntityType({ name: values.name, accountingRelation });
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
      description="Define a new entity type available in the Type field. Its accounting relation decides which control account (Receivable or Payable) entities of this type post against automatically."
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
        <Controller
          name="accountingRelation"
          control={control}
          rules={{ required: 'Accounting relation is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Accounting Relation"
              placeholder="Select…"
              options={ACCOUNTING_RELATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountingRelation?.message}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
