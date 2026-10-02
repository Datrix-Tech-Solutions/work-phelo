'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SubledgerAccount, SubledgerType } from '@/types/accounting';
import { useCreateSubledger, useEntityTypes, useSubledgers, useUpdateSubledger } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddEntityPanelProps {
  isOpen: boolean;
  onClose: () => void;

  initialName?: string;

  initialControlAccountId?: string;
  initialControlAccountLabel?: string;

  allowedTypes?: SubledgerType[];

  onCreated?: (subledger: SubledgerAccount) => void;
  entity?: SubledgerAccount | null;
}

type FormValues = {
  code: string;
  name: string;
  type: string;
  controlAccountId: string;
  contactName: string;
  phone: string;
  address: string;
  description: string;
};

const DEFAULTS: FormValues = {
  code: '',
  name: '',
  type: '',
  controlAccountId: '',
  contactName: '',
  phone: '',
  address: '',
  description: '',
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
  const { data: existingEntities = [] } = useSubledgers();

  // Suggests the next free code for a type: its ID prefix + the highest existing number for
  // that prefix + 1 (e.g. SUP-0007). Still editable, and the backend stays the authority on
  // uniqueness.
  const nextCodeFor = (typeValue: string) => {
    const prefix = entityTypesData.find((t) => t.name.trim().toUpperCase() === typeValue)?.code;
    if (!prefix) return null;
    const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
    const highest = existingEntities.reduce((max, e) => {
      const match = pattern.exec(e.code);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
  };

  const typeOptions: SearchSelectOption[] = useMemo(() => {
    return entityTypesData
      .map((t) => ({ label: t.name, value: t.name.trim().toUpperCase() }))
      .filter((t) => !allowedTypes || allowedTypes.includes(t.value as SubledgerType));
  }, [entityTypesData, allowedTypes]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    if (entity) {
      reset({
        code: entity.code,
        name: entity.name,
        type: entity.type,
        controlAccountId: entity.controlAccountId ?? '',
        contactName: entity.contactName ?? '',
        phone: entity.phone ?? '',
        address: entity.address ?? '',
        description: entity.description ?? '',
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
        type: data.type,
        controlAccountId: data.controlAccountId || undefined,
        contactName: data.contactName.trim() || undefined,
        phone: data.phone || undefined,
        address: data.address.trim() || undefined,
        description: data.description.trim() || undefined,
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
      <div className="flex flex-col gap-3">
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
              onChange={(value) => {
                field.onChange(value);
                if (isEditing) return;
                const code = nextCodeFor(value);
                if (code) setValue('code', code, { shouldValidate: true });
              }}
              error={errors.type?.message}
            />
          )}
        />

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

        {initialControlAccountId && (
          <Input label="Control Account" value={initialControlAccountLabel ?? ''} readOnly />
        )}

        <FormField
          label="Contact Person"
          registration={register('contactName')}
          error={errors.contactName}
          placeholder="e.g. Jane Doe"
        />

        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Contact"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />

        <FormField
          label="Address"
          registration={register('address')}
          error={errors.address}
          placeholder="Optional address"
        />

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />
      </div>
    </SidePanel>
  );
}
