'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SUBLEDGER_TYPE_LABELS, SubledgerAccount, SubledgerType } from '@/types/accounting';
import { useCreateSubledger, useEntityTypes, useUpdateSubledger } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddEntityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fills the entity name — e.g. with what the caller had already typed while
   *  searching for a subledger that didn't exist yet. */
  initialName?: string;
  /** Pins the entity to a specific control account instead of leaving it up to the user —
   *  e.g. when creating one for a journal line that's already targeting that account. When
   *  set, the Control Account field is shown read-only (must be paired with
   *  `initialControlAccountLabel` for a readable display). */
  initialControlAccountId?: string;
  initialControlAccountLabel?: string;
  /** Restricts the Entity Type dropdown to a subset — e.g. `['CUSTOMER', 'VENDOR']` for a
   *  quick-add flow that shouldn't also offer Employee/Statutory/Other. Defaults to every
   *  manually-creatable type. */
  allowedTypes?: SubledgerType[];
  /** Fires with the newly created subledger after a successful save, before the panel
   *  closes — lets a caller (e.g. a journal line picker) select it immediately instead of
   *  making the user reopen the dropdown and search again. */
  onCreated?: (subledger: SubledgerAccount) => void;
  /** Editing an existing entity instead of creating one. */
  entity?: SubledgerAccount | null;
}

type FormValues = {
  code: string;
  name: string;
  type: SubledgerType | '';
  controlAccountId: string;
  contactName: string;
  address: string;
};

const DEFAULTS: FormValues = {
  code: '',
  name: '',
  type: '',
  controlAccountId: '',
  contactName: '',
  address: '',
};

export function AddEntityPanel({
  isOpen,
  onClose,
  initialName,
  initialControlAccountId,
  initialControlAccountLabel,
  allowedTypes,
  onCreated,
  entity,
}: AddEntityPanelProps) {
  const isEditing = !!entity;
  const toast = useToast();
  const { mutateAsync: createSubledger, isPending: isCreating } = useCreateSubledger();
  const { mutateAsync: updateSubledger, isPending: isUpdating } = useUpdateSubledger();
  const isPending = isCreating || isUpdating;
  const { data: entityTypesData = [] } = useEntityTypes();

  // Sourced from the tenant's own Entity Types list (Settings > Entities > Types), not a
  // hardcoded set — Customer/Vendor come pre-seeded there; anything else must be created
  // there first. Only names that map to a real SubledgerType (the enum this ultimately
  // posts against) are offered — a custom type not yet backed by one can't be submitted.
  const typeOptions: SearchSelectOption[] = useMemo(() => {
    const validValues = new Set(Object.keys(SUBLEDGER_TYPE_LABELS));
    return entityTypesData
      .map((t) => ({ label: t.name, value: t.name.trim().toUpperCase() }))
      .filter(
        (t) =>
          validValues.has(t.value) &&
          (!allowedTypes || allowedTypes.includes(t.value as SubledgerType)),
      );
  }, [entityTypesData, allowedTypes]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // Seed the name and (when the caller already knows it) the control account each time the
  // panel opens — or, when editing, the existing entity's own values.
  useEffect(() => {
    if (!isOpen) return;
    if (entity) {
      reset({
        code: entity.code,
        name: entity.name,
        type: entity.type,
        controlAccountId: entity.controlAccountId,
        contactName: entity.contactName ?? '',
        address: entity.address ?? '',
      });
    } else {
      reset({
        ...DEFAULTS,
        name: initialName ?? '',
        controlAccountId: initialControlAccountId ?? '',
      });
    }
  }, [isOpen, entity, initialName, initialControlAccountId, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        code: data.code.trim(),
        name: data.name.trim(),
        type: data.type as SubledgerType,
        controlAccountId: data.controlAccountId || undefined,
        contactName: data.contactName.trim() || undefined,
        address: data.address.trim() || undefined,
      };
      const subledger = entity
        ? await updateSubledger({ id: entity.id, ...payload })
        : await createSubledger(payload);
      toast.success(isEditing ? 'Entity updated successfully' : 'Entity created successfully');
      onCreated?.(subledger);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, `Failed to ${isEditing ? 'update' : 'create'} entity`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Update Entity' : 'Add Entity'}
      description="Register a new subledger entity in your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add Entity'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Entity Code"
          registration={register('code', { required: 'Entity code is required' })}
          error={errors.code}
          placeholder="e.g. ENT-0001"
        />

        <FormField
          label="Entity Name"
          registration={register('name', { required: 'Entity name is required' })}
          error={errors.name}
          placeholder="e.g. Acme Supplies Ltd."
        />

        <Controller
          name="type"
          control={control}
          rules={{ required: 'Entity type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Entity Type"
              placeholder="Select type…"
              options={typeOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />

        {initialControlAccountId && (
          <Input label="Control Account" value={initialControlAccountLabel ?? ''} readOnly />
        )}

        <FormField
          label="Contact"
          registration={register('contactName')}
          error={errors.contactName}
          placeholder="e.g. Jane Doe"
        />

        <FormField
          label="Address"
          type="textarea"
          rows={3}
          registration={register('address')}
          error={errors.address}
          placeholder="Optional address"
        />
      </div>
    </SidePanel>
  );
}
