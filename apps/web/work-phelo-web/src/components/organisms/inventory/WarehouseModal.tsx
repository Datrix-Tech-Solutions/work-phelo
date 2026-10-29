'use client';

import type { ChangeEvent } from 'react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useCreateInventoryWarehouse,
  useUpdateInventoryWarehouse,
  type InventoryWarehouse,
} from '@/hooks/inventory/useInventoryWarehouses';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { suggestTransactionTypeCode } from '@/lib/accounting/transactionTypeCode';

interface WarehouseFormValues {
  name: string;
  code: string;
  address: string;
}

const FORM_DEFAULTS: WarehouseFormValues = { name: '', code: '', address: '' };

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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<WarehouseFormValues>({ defaultValues: FORM_DEFAULTS });

  // Open on the warehouse being edited, or on a blank form when adding.
  useEffect(() => {
    if (!isOpen) return;
    reset(
      warehouse
        ? { name: warehouse.name, code: warehouse.code, address: warehouse.address ?? '' }
        : FORM_DEFAULTS,
    );
  }, [isOpen, warehouse, reset]);

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

  const onSubmit = (data: WarehouseFormValues) => {
    const values = {
      name: data.name.trim(),
      code: data.code.trim(),
      address: data.address.trim() || null,
    };
    if (warehouse) {
      updateWarehouse(warehouse.id, values);
      toast.success('Warehouse updated successfully');
      handleClose();
      return;
    }
    createWarehouse(values);
    toast.success('Warehouse created successfully');
    entry.finishSave(
      { title: 'Warehouse Added!', message: `${data.name.trim()} has been added.` },
      handleClose,
    );
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

        <FormField
          label="Address"
          type="textarea"
          rows={3}
          registration={register('address', {
            maxLength: { value: 300, message: 'Address cannot exceed 300 characters' },
          })}
          error={errors.address}
          placeholder="e.g. 12 Industrial Road, Tema"
        />
      </div>
    </Modal>
  );
}
