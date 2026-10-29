'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CategoryIconPicker } from '@/components/atoms/CategoryIconPicker';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  type InventoryCategory,
} from '@/hooks/inventory/useInventoryCategories';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CATEGORY_ICON, type CategoryIconKey } from '@/lib/inventoryCategoryIcons';

interface CategoryFormValues {
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
  icon: CategoryIconKey;
}

const FORM_DEFAULTS: CategoryFormValues = {
  name: '',
  status: 'ACTIVE',
  description: '',
  icon: DEFAULT_CATEGORY_ICON,
};

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The category being edited; omit to add a new one. */
  category?: InventoryCategory | null;
}

export function CategoryModal({ isOpen, onClose, category }: CategoryModalProps) {
  const toast = useToast();
  const isEditing = !!category;
  const { createCategory, isPending } = useCreateInventoryCategory();
  const { updateCategory } = useUpdateInventoryCategory();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CategoryFormValues>({ defaultValues: FORM_DEFAULTS });

  // Open on the category being edited, or on a blank form when adding.
  useEffect(() => {
    if (!isOpen) return;
    reset(
      category
        ? {
            name: category.name,
            status: category.status,
            description: category.description ?? '',
            icon: category.icon,
          }
        : FORM_DEFAULTS,
    );
  }, [isOpen, category, reset]);

  const status = useWatch({ control, name: 'status' });
  const icon = useWatch({ control, name: 'icon' });

  const handleClose = () => {
    reset(FORM_DEFAULTS);
    onClose();
  };

  // Multi-entry: with the lock on, saving keeps the modal open and asks Continue / Stop. Continue
  // clears the name and description for the next category but keeps the status and icon.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () =>
      reset({
        ...FORM_DEFAULTS,
        status: getValues('status'),
        icon: getValues('icon'),
      }),
  });

  const onSubmit = (data: CategoryFormValues) => {
    const values = {
      name: data.name.trim(),
      description: data.description.trim() || null,
      icon: data.icon,
      status: data.status,
    };
    if (category) {
      updateCategory(category.id, values);
      toast.success('Category updated successfully');
      handleClose();
      return;
    }
    createCategory(values);
    toast.success('Category created successfully');
    entry.finishSave(
      { title: 'Category Added!', message: `${data.name.trim()} has been added.` },
      handleClose,
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Category' : 'Add Category'}
      description={
        isEditing
          ? 'Update the details of this category.'
          : 'Create a category to group your inventory items.'
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
            {isEditing ? 'Save Changes' : 'Save Category'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 min-w-0">
            <FormField
              label="Category Name"
              registration={register('name', {
                required: 'Category name is required',
                validate: (v) => v.trim().length > 0 || 'Category name is required',
                maxLength: { value: 100, message: 'Name cannot exceed 100 characters' },
              })}
              error={errors.name}
              placeholder="e.g. Electronics, Stationery"
            />
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
        </div>

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', {
            maxLength: { value: 500, message: 'Description cannot exceed 500 characters' },
          })}
          error={errors.description}
          placeholder="e.g. Computers, phones and accessories."
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-900">Icon</span>
          <div>
            <CategoryIconPicker value={icon} onChange={(v) => setValue('icon', v)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
