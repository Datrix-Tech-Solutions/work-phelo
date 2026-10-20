'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { Toggle } from '@/components/atoms/Toggle';
import { NumberField } from '@/components/atoms/NumberField';
import {
  AmlAmountPeriod,
  AmlCountPeriod,
  AmlRiskRating,
  SubledgerAccount,
  SubledgerType,
} from '@/types/accounting';
import { useCreateSubledger, useEntityTypes, useSubledgers, useUpdateSubledger } from '@/hooks';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
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
  monitorWithAml: boolean;
  isPoliticallyExposed: boolean;
  riskRating: AmlRiskRating | '';
  amlAmountLimit: number;
  amlAmountPeriod: AmlAmountPeriod | '';
  amlTransactionCountLimit: number;
  amlTransactionCountPeriod: AmlCountPeriod | '';
};

const RISK_OPTIONS: SearchSelectOption[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
];

const AMOUNT_PERIOD_OPTIONS: SearchSelectOption[] = [
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Yearly', value: 'YEARLY' },
];

const COUNT_PERIOD_OPTIONS: SearchSelectOption[] = [
  { label: '12 hours', value: 'HOURS_12' },
  { label: '24 hours', value: 'HOURS_24' },
  { label: '48 hours', value: 'HOURS_48' },
];

const DEFAULTS: FormValues = {
  code: '',
  name: '',
  type: '',
  controlAccountId: '',
  contactName: '',
  phone: '',
  address: '',
  description: '',
  monitorWithAml: false,
  isPoliticallyExposed: false,
  riskRating: '',
  amlAmountLimit: 0,
  amlAmountPeriod: '',
  amlTransactionCountLimit: 0,
  amlTransactionCountPeriod: '',
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
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const monitorWithAml = watch('monitorWithAml');

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
        monitorWithAml: entity.monitorWithAml ?? false,
        isPoliticallyExposed: entity.isPoliticallyExposed ?? false,
        riskRating: entity.riskRating ?? '',
        amlAmountLimit: Number(entity.amlAmountLimit ?? 0),
        amlAmountPeriod: entity.amlAmountPeriod ?? '',
        amlTransactionCountLimit: entity.amlTransactionCountLimit ?? 0,
        amlTransactionCountPeriod: entity.amlTransactionCountPeriod ?? '',
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

  // Multi-entry: with the lock on, saving keeps the panel open and asks Continue / Stop. Continue
  // clears the form for the next entity but keeps the type, with its next free code. Only when
  // adding on its own — editing, or being opened from another form that takes the new entity
  // back (onCreated), saves and closes as usual.
  const canMultiEntry = !isEditing && !onCreated;
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => {
      const type = getValues('type');
      reset({
        ...DEFAULTS,
        type,
        code: nextCodeFor(type) ?? '',
        controlAccountId: initialControlAccountId ?? '',
      });
    },
  });

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
        monitorWithAml: data.monitorWithAml,
        ...(data.monitorWithAml && {
          isPoliticallyExposed: data.isPoliticallyExposed,
          riskRating: data.riskRating || undefined,
          amlAmountLimit: data.amlAmountLimit || undefined,
          amlAmountPeriod: data.amlAmountPeriod || undefined,
          amlTransactionCountLimit: data.amlTransactionCountLimit || undefined,
          amlTransactionCountPeriod: data.amlTransactionCountPeriod || undefined,
        }),
      };
      const subledger = entity
        ? await updateSubledger({ id: entity.id, ...payload })
        : await createSubledger(payload);
      toast.success(isEditing ? 'Entity updated successfully' : 'Entity created successfully');
      onCreated?.(subledger);
      entry.finishSave(
        { title: 'Entity Added!', message: `${subledger.name} has been added.` },
        handleClose,
      );
    } catch (err) {
      toast.error(extractError(err, `Failed to ${isEditing ? 'update' : 'create'} entity`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      {...entry.panelProps}
      lock={canMultiEntry ? entry.panelProps.lock : undefined}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
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
        </div>

        <div
          className={`grid grid-cols-1 gap-3 ${initialControlAccountId ? 'sm:grid-cols-2' : ''}`}
        >
          <FormField
            label="Entity Name"
            registration={register('name', { required: 'Entity name is required' })}
            error={errors.name}
            placeholder="e.g. Acme Supplies Ltd."
          />

          {initialControlAccountId && (
            <Input label="Control Account" value={initialControlAccountLabel ?? ''} readOnly />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>

        <FormField
          label="Address"
          registration={register('address')}
          error={errors.address}
          placeholder="Optional address"
        />

        <FormField
          label="Description"
          type="textarea"
          rows={2}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />

        <Controller
          control={control}
          name="monitorWithAml"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-sm font-bold text-gray-900">Monitor with AML</span>
              <Toggle enabled={field.value} onChange={field.onChange} />
            </div>
          )}
        />

        {monitorWithAml && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="isPoliticallyExposed"
                render={({ field }) => (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-sm font-bold text-gray-900">
                      Is this person politically exposed?
                    </span>
                    <Toggle enabled={field.value} onChange={field.onChange} />
                  </div>
                )}
              />

              <Controller
                control={control}
                name="riskRating"
                rules={{ required: 'Risk rating is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Risk Rating"
                    placeholder="Select rating…"
                    options={RISK_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.riskRating?.message}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="amlAmountLimit"
                render={({ field }) => (
                  <NumberField
                    label="Transaction Amount Limit"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="amlAmountPeriod"
                render={({ field }) => (
                  <SearchSelect
                    label="Period"
                    placeholder="Select period…"
                    options={AMOUNT_PERIOD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="amlTransactionCountLimit"
                render={({ field }) => (
                  <NumberField
                    label="Number of Transactions"
                    value={field.value}
                    onChange={field.onChange}
                    decimals={0}
                  />
                )}
              />

              <Controller
                control={control}
                name="amlTransactionCountPeriod"
                render={({ field }) => (
                  <SearchSelect
                    label="Period"
                    placeholder="Select period…"
                    options={COUNT_PERIOD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
