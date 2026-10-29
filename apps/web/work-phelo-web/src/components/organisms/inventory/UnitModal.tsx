'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useCreateInventoryUnit,
  useUpdateInventoryUnit,
  type InventoryUnit,
} from '@/hooks/inventory/useInventoryUnits';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import {
  UNIT_NAME_OPTIONS,
  UNIT_SYMBOL_OPTIONS,
  nameForUnitSymbol,
  symbolForUnitName,
} from '@/lib/inventoryUnits';

interface UnitFormValues {
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
}

const FORM_DEFAULTS: UnitFormValues = {
  name: '',
  symbol: '',
  status: 'ACTIVE',
  description: '',
};

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The unit being edited; omit to add a new one. */
  unit?: InventoryUnit | null;
}

export function UnitModal({ isOpen, onClose, unit }: UnitModalProps) {
  const toast = useToast();
  const isEditing = !!unit;
  const { createUnit, isPending } = useCreateInventoryUnit();
  const { updateUnit } = useUpdateInventoryUnit();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<UnitFormValues>({ defaultValues: FORM_DEFAULTS });

  // Open on the unit being edited, or on a blank form when adding.
  useEffect(() => {
    if (!isOpen) return;
    reset(
      unit
        ? {
            name: unit.name,
            symbol: unit.symbol,
            status: unit.status,
            description: unit.description ?? '',
          }
        : FORM_DEFAULTS,
    );
  }, [isOpen, unit, reset]);

  const status = useWatch({ control, name: 'status' });

  const handleClose = () => {
    reset(FORM_DEFAULTS);
    onClose();
  };

  // Multi-entry: with the lock on, saving keeps the modal open and asks Continue / Stop. Continue
  // clears the fields for the next unit but keeps the status.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => reset({ ...FORM_DEFAULTS, status: getValues('status') }),
  });

  const onSubmit = (data: UnitFormValues) => {
    const values = {
      name: data.name.trim(),
      symbol: data.symbol.trim(),
      description: data.description.trim() || null,
      status: data.status,
    };
    if (unit) {
      updateUnit(unit.id, values);
      toast.success('Unit of measure updated successfully');
      handleClose();
      return;
    }
    createUnit(values);
    toast.success('Unit of measure created successfully');
    entry.finishSave(
      { title: 'Unit Added!', message: `${data.name.trim()} has been added.` },
      handleClose,
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Unit of Measure' : 'Add Unit of Measure'}
      description={
        isEditing
          ? 'Update the details of this unit.'
          : 'Create a unit to measure your inventory items in.'
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
            {isEditing ? 'Save Changes' : 'Save Unit'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 min-w-0">
            <Controller
              control={control}
              name="name"
              rules={{
                validate: (v) => v.trim().length > 0 || 'Unit name is required',
                maxLength: { value: 100, message: 'Name cannot exceed 100 characters' },
              }}
              render={({ field, fieldState }) => (
                <CreatableSearchSelect
                  label="Unit Name"
                  placeholder="e.g. Kilogram, Litre, Piece"
                  options={UNIT_NAME_OPTIONS}
                  value={field.value}
                  onChange={(name) => {
                    field.onChange(name);
                    // A common unit brings its symbol along; the symbol can still be changed.
                    const symbol = symbolForUnitName(name);
                    if (symbol) setValue('symbol', symbol, { shouldValidate: true });
                  }}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
          <div className="sm:w-48">
            <Controller
              control={control}
              name="symbol"
              rules={{
                validate: (v) => v.trim().length > 0 || 'Symbol is required',
                maxLength: { value: 10, message: 'Symbol cannot exceed 10 characters' },
              }}
              render={({ field, fieldState }) => (
                <CreatableSearchSelect
                  label="Symbol"
                  placeholder="e.g. kg, L, pc"
                  options={UNIT_SYMBOL_OPTIONS}
                  value={field.value}
                  onChange={(symbol) => {
                    field.onChange(symbol);
                    // A common symbol brings its name along, unless a custom name was already typed.
                    const name = nameForUnitSymbol(symbol);
                    const current = getValues('name').trim();
                    if (name && (!current || symbolForUnitName(current))) {
                      setValue('name', name, { shouldValidate: true });
                    }
                  }}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-900">Status</span>
          <SegmentedToggle
            value={status}
            onChange={(v) => setValue('status', v)}
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
            ]}
          />
        </div>

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', {
            maxLength: { value: 500, message: 'Description cannot exceed 500 characters' },
          })}
          error={errors.description}
          placeholder="e.g. Standard unit of mass in the metric system."
        />
      </div>
    </Modal>
  );
}
