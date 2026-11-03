'use client';

import type { ChangeEvent } from 'react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { StatusRadioGroup } from '@/components/atoms/StatusRadioGroup';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useCreateInventoryWarehouse,
  useUpdateInventoryWarehouse,
  type InventoryLocationType,
  type InventoryWarehouse,
} from '@/hooks/inventory/useInventoryWarehouses';
import { useInventoryModuleUsers } from '@/hooks/inventory/useInventoryModuleUsers';
import { useBranchOptions } from '@/hooks/hr/useBranches';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { suggestTransactionTypeCode } from '@/lib/accounting/transactionTypeCode';
import { extractError } from '@/lib/extractError';

type FormLocationType = InventoryLocationType | 'TRANSIT';

// "Transit Location" is offered in the form, but the service has no such type yet, so it is saved
// as Other until the service adds it.
const LOCATION_TYPE_OPTIONS: { value: FormLocationType; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'STORE', label: 'Store' },
  { value: 'BRANCH', label: 'Branch Store' },
  { value: 'OFFICE_STORE', label: 'Office Store' },
  { value: 'TRANSIT', label: 'Transit Location' },
  { value: 'OTHER', label: 'Other' },
];

const toApiType = (t: FormLocationType): InventoryLocationType => (t === 'TRANSIT' ? 'OTHER' : t);

interface WarehouseFormValues {
  name: string;
  code: string;
  type: FormLocationType;
  /** Not saved yet: the service has no field for branch, manager or description. */
  branchId: string;
  managerId: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const FORM_DEFAULTS: WarehouseFormValues = {
  name: '',
  code: '',
  type: 'WAREHOUSE',
  branchId: '',
  managerId: '',
  description: '',
  status: 'ACTIVE',
};

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The warehouse being edited; omit to add a new one. */
  warehouse?: InventoryWarehouse | null;
}

export function WarehouseModal({ isOpen, onClose, warehouse }: WarehouseModalProps) {
  const toast = useToast();
  const isEditing = !!warehouse;
  const { createWarehouse, isPending } = useCreateInventoryWarehouse();
  const { updateWarehouse } = useUpdateInventoryWarehouse();
  const { data: branches = [] } = useBranchOptions(isOpen);
  const { users: managers } = useInventoryModuleUsers();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, dirtyFields },
  } = useForm<WarehouseFormValues>({ defaultValues: FORM_DEFAULTS });

  // Open on the warehouse being edited, or on a blank form when adding.
  useEffect(() => {
    if (!isOpen) return;
    reset(
      warehouse
        ? {
            name: warehouse.name,
            code: warehouse.code,
            type: warehouse.type,
            branchId: '',
            managerId: '',
            description: '',
            status: warehouse.status,
          }
        : FORM_DEFAULTS,
    );
  }, [isOpen, warehouse, reset]);

  const status = useWatch({ control, name: 'status' });

  const handleClose = () => {
    reset(FORM_DEFAULTS);
    onClose();
  };

  // Multi-entry: with the lock on, saving keeps the modal open and asks Continue / Stop.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => reset(FORM_DEFAULTS),
  });

  const save = async (data: WarehouseFormValues) => {
    const values = {
      name: data.name.trim(),
      code: data.code.trim(),
      type: toApiType(data.type),
      status: data.status,
    };
    if (warehouse) {
      await updateWarehouse(warehouse.id, values);
      toast.success('Warehouse updated successfully');
      handleClose();
      return;
    }
    await createWarehouse(values);
    toast.success('Warehouse created successfully');
    entry.finishSave(
      { title: 'Warehouse Added!', message: `${data.name.trim()} has been added.` },
      handleClose,
    );
  };

  const onSubmit = async (data: WarehouseFormValues) => {
    try {
      await save(data);
    } catch (err) {
      toast.error(extractError(err, 'Could not save warehouse'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Warehouse' : 'Add Warehouse'}
      description={
        isEditing
          ? 'Update the details of this warehouse.'
          : 'Create a location where your inventory is stored.'
      }
      width="max-w-xl"
      {...entry.panelProps}
      lock={isEditing ? undefined : entry.panelProps.lock}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Save Warehouse'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
          <FormField
            label="Name"
            registration={register('name', {
              required: 'Name is required',
              validate: (v) => v.trim().length > 0 || 'Name is required',
              maxLength: { value: 100, message: 'Name cannot exceed 100 characters' },
              // A typed code is dirty, so it is left alone; clearing it resumes suggesting.
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                if (!isEditing && !dirtyFields.code)
                  setValue('code', suggestTransactionTypeCode(e.target.value));
              },
            })}
            error={errors.name}
            placeholder="e.g. Main Warehouse"
          />
          <FormField
            label="Code"
            registration={register('code', {
              required: 'Code is required',
              validate: (v) => v.trim().length > 0 || 'Code is required',
              maxLength: { value: 30, message: 'Code cannot exceed 30 characters' },
              setValueAs: (value: string) => value.toUpperCase(),
            })}
            error={errors.code}
            placeholder="e.g. MAI-WAR"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 min-w-0">
            <Controller
              control={control}
              name="type"
              rules={{ required: 'Select a location type' }}
              render={({ field, fieldState }) => (
                <SearchSelect
                  label="Location Type"
                  placeholder="Select type"
                  options={LOCATION_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  clearable={false}
                />
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <Controller
              control={control}
              name="branchId"
              render={({ field }) => (
                <SearchSelect
                  label="Branch / Location"
                  placeholder="Select branch"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>

        <Controller
          control={control}
          name="managerId"
          render={({ field }) => (
            <SearchSelect
              label="Warehouse Manager"
              placeholder="Select manager"
              options={managers.map((u) => ({ value: u.id, label: u.name, sublabel: u.email }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', {
            maxLength: { value: 500, message: 'Description cannot exceed 500 characters' },
          })}
          error={errors.description}
          placeholder="Optional details about this location"
        />

        <StatusRadioGroup value={status} onChange={(v) => setValue('status', v)} />
      </div>
    </Modal>
  );
}
