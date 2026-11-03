'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { ImageUploadField } from '@/components/atoms/ImageUploadField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { StatusRadioGroup } from '@/components/atoms/StatusRadioGroup';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
  type InventoryItem,
} from '@/hooks/inventory/useInventoryItems';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface ItemFormValues {
  name: string;
  sku: string;
  categoryId: string;
  unitId: string;
  description: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: string;
  status: 'ACTIVE' | 'INACTIVE';
  imageUrl: string | null;
}

const FORM_DEFAULTS: ItemFormValues = {
  name: '',
  sku: '',
  categoryId: '',
  unitId: '',
  description: '',
  costPrice: '',
  sellingPrice: '',
  reorderLevel: '',
  status: 'ACTIVE',
  imageUrl: null,
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const optionalNumber = (v: string) => (v.trim() === '' ? null : Number(v));
const nonNegative = (v: string) => v.trim() === '' || Number(v) >= 0 || 'Must be 0 or more';

interface ItemPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** The item being edited; omit to add a new one. */
  item?: InventoryItem | null;
}

export function ItemPanel({ isOpen, onClose, item }: ItemPanelProps) {
  const toast = useToast();
  const isEditing = !!item;
  const { createItem, isPending } = useCreateInventoryItem();
  const { updateItem } = useUpdateInventoryItem();
  const { categories } = useInventoryCategories();
  const { units } = useInventoryUnits();
  // Display-only for now: the inventory service stores no currency on an item.
  const [currency, setCurrency] = useState('GHS');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ItemFormValues>({ defaultValues: FORM_DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      item
        ? {
            name: item.name,
            sku: item.sku,
            categoryId: item.categoryId,
            unitId: item.unitId,
            description: item.description ?? '',
            costPrice: item.costPrice?.toString() ?? '',
            sellingPrice: item.sellingPrice?.toString() ?? '',
            reorderLevel: item.reorderLevel?.toString() ?? '',
            status: item.status,
            imageUrl: item.imageUrl,
          }
        : FORM_DEFAULTS,
    );
  }, [isOpen, item, reset]);

  const status = useWatch({ control, name: 'status' });
  const imageUrl = useWatch({ control, name: 'imageUrl' });
  const costPrice = useWatch({ control, name: 'costPrice' });
  const sellingPrice = useWatch({ control, name: 'sellingPrice' });

  // Inactive categories/units can't be picked for new work, but an item keeps the one it has.
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.status === 'ACTIVE' || c.id === item?.categoryId)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, item],
  );
  const unitOptions = useMemo(
    () =>
      units
        .filter((u) => u.status === 'ACTIVE' || u.id === item?.unitId)
        .map((u) => ({ value: u.id, label: u.name, sublabel: u.symbol })),
    [units, item],
  );

  const handleClose = () => {
    reset(FORM_DEFAULTS);
    onClose();
  };

  // Multi-entry: Continue clears the item-specific fields but keeps category, unit and status.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () =>
      reset({
        ...FORM_DEFAULTS,
        categoryId: getValues('categoryId'),
        unitId: getValues('unitId'),
        status: getValues('status'),
      }),
  });

  const save = async (data: ItemFormValues) => {
    const values = {
      name: data.name.trim(),
      sku: data.sku.trim(),
      categoryId: data.categoryId,
      unitId: data.unitId,
      description: data.description.trim() || null,
      costPrice: optionalNumber(data.costPrice),
      sellingPrice: optionalNumber(data.sellingPrice),
      reorderLevel: optionalNumber(data.reorderLevel),
      status: data.status,
      imageUrl: data.imageUrl,
    };
    if (item) {
      await updateItem(item.id, values);
      toast.success('Item updated successfully');
      handleClose();
      return;
    }
    await createItem(values);
    toast.success('Item created successfully');
    entry.finishSave(
      { title: 'Item Added!', message: `${values.name} has been added.` },
      handleClose,
    );
  };

  const onSubmit = async (data: ItemFormValues) => {
    try {
      await save(data);
    } catch (err) {
      toast.error(extractError(err, 'Could not save item'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Item' : 'Add Item'}
      description={
        isEditing ? 'Update the details of this item.' : 'Add an item to your inventory.'
      }
      {...entry.panelProps}
      lock={isEditing ? undefined : entry.panelProps.lock}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Save Item'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <FormSection title="Basic Details">
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 min-w-0">
                <FormField
                  label="Item Name"
                  registration={register('name', {
                    required: 'Item name is required',
                    validate: (v) => v.trim().length > 0 || 'Item name is required',
                    maxLength: { value: 150, message: 'Name cannot exceed 150 characters' },
                  })}
                  error={errors.name}
                  placeholder="e.g. A4 Paper"
                />
              </div>
              <div className="flex-1 min-w-0">
                <FormField
                  label="SKU"
                  registration={register('sku', {
                    required: 'SKU is required',
                    validate: (v) => v.trim().length > 0 || 'SKU is required',
                    maxLength: { value: 64, message: 'SKU cannot exceed 64 characters' },
                  })}
                  error={errors.sku}
                  placeholder="e.g. PAP-A4-001"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 min-w-0">
                <Controller
                  control={control}
                  name="categoryId"
                  rules={{ required: 'Select a category' }}
                  render={({ field, fieldState }) => (
                    <SearchSelect
                      label="Item Category"
                      placeholder="Select category"
                      options={categoryOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      size="md"
                    />
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <Controller
                  control={control}
                  name="unitId"
                  rules={{ required: 'Select a unit of measure' }}
                  render={({ field, fieldState }) => (
                    <SearchSelect
                      label="Unit of Measure"
                      placeholder="Select unit"
                      options={unitOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      size="md"
                    />
                  )}
                />
              </div>
            </div>

            <FormField
              label="Description"
              type="textarea"
              rows={3}
              registration={register('description', {
                maxLength: { value: 500, message: 'Description cannot exceed 500 characters' },
              })}
              error={errors.description}
              placeholder="Optional details about this item."
            />
          </div>
        </FormSection>

        <hr className="border-gray-200" />

        <FormSection title="Pricing & Stock">
          <div className="flex flex-col gap-4 sm:flex-row mt-2">
            <div className="flex-1 min-w-0">
              <CurrencyInput
                label="Purchase Cost"
                value={costPrice}
                currency={currency}
                onValueChange={(v) => setValue('costPrice', v, { shouldValidate: true })}
                onCurrencyChange={setCurrency}
                error={errors.costPrice?.message}
              />
            </div>
            <div className="flex-1 min-w-0">
              <CurrencyInput
                label="Selling Price"
                value={sellingPrice}
                currency={currency}
                onValueChange={(v) => setValue('sellingPrice', v, { shouldValidate: true })}
                onCurrencyChange={setCurrency}
                error={errors.sellingPrice?.message}
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="w-full sm:w-48 shrink-0">
                <FormField
                  label="Reorder Level"
                  type="number"
                  step="any"
                  registration={register('reorderLevel', { validate: nonNegative })}
                  error={errors.reorderLevel}
                  placeholder="0"
                />
              </div>
              <StatusRadioGroup value={status} onChange={(v) => setValue('status', v)} />
            </div>
          </div>
        </FormSection>

        <hr className="border-gray-200" />

        <FormSection title="Image">
          <div className="mt-2">
            <ImageUploadField
              hint="PNG, JPG or WebP, up to 2 MB."
              value={imageUrl}
              onChange={(url) => setValue('imageUrl', url)}
              onClear={() => setValue('imageUrl', null)}
              allowedTypes={IMAGE_TYPES}
              accept={IMAGE_TYPES.join(',')}
              maxBytes={MAX_IMAGE_BYTES}
              onError={(m) => toast.error(m)}
            />
          </div>
        </FormSection>
      </div>
    </SidePanel>
  );
}
