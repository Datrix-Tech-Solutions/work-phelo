'use client';

import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CategoryIconPicker } from '@/components/atoms/CategoryIconPicker';
import { StatusRadioGroup } from '@/components/atoms/StatusRadioGroup';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  type InventoryCategory,
} from '@/hooks/inventory/useInventoryCategories';
import { useCategorySubcategories } from '@/hooks/inventory/useCategorySubcategories';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CATEGORY_ICON, type CategoryIconKey } from '@/lib/inventoryCategoryIcons';
import { extractError } from '@/lib/extractError';

interface CategoryFormValues {
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
  icon: CategoryIconKey;
  subcategories: { name: string }[];
}

const FORM_DEFAULTS: CategoryFormValues = {
  name: '',
  status: 'ACTIVE',
  description: '',
  icon: DEFAULT_CATEGORY_ICON,
  subcategories: [],
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
    subcategories: savedSubcategories,
    createSubcategory,
    deleteSubcategory,
  } = useCategorySubcategories(category?.id);

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
            subcategories: savedSubcategories.map((s) => ({ name: s.name })),
          }
        : FORM_DEFAULTS,
    );
    // Only reset when the modal opens on a category, not each time subcategories are saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, category, reset]);

  const {
    fields: subFields,
    append: addSub,
    remove: removeSub,
  } = useFieldArray({ control, name: 'subcategories' });

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

  // Makes the category's subcategories match the list in the form: adds new names and removes the
  // ones taken out. One that items still use can't be removed; it is kept and reported.
  const syncSubcategories = async (
    categoryId: string,
    names: string[],
    saved: { id: string; name: string }[],
  ) => {
    const wanted = [...new Set(names)];
    const kept: string[] = [];
    for (const s of saved) {
      if (wanted.includes(s.name)) continue;
      try {
        await deleteSubcategory(s.id);
      } catch {
        kept.push(s.name);
      }
    }
    for (const name of wanted) {
      if (!saved.some((s) => s.name === name)) await createSubcategory(categoryId, name);
    }
    if (kept.length) {
      toast.error(`Could not remove ${kept.join(', ')}: still used by items`);
    }
  };

  const save = async (data: CategoryFormValues) => {
    const values = {
      name: data.name.trim(),
      description: data.description.trim() || null,
      icon: data.icon,
      status: data.status,
    };
    const subs = data.subcategories.map((r) => r.name.trim()).filter(Boolean);
    if (category) {
      await updateCategory(category.id, values);
      await syncSubcategories(category.id, subs, savedSubcategories);
      toast.success('Category updated successfully');
      handleClose();
      return;
    }
    const created = await createCategory(values);
    await syncSubcategories(created.id, subs, []);
    toast.success('Category created successfully');
    entry.finishSave(
      { title: 'Category Added!', message: `${data.name.trim()} has been added.` },
      handleClose,
    );
  };

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      await save(data);
    } catch (err) {
      toast.error(extractError(err, 'Could not save category'));
    }
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
          <StatusRadioGroup value={status} onChange={(v) => setValue('status', v)} />
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

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-gray-900">Subcategories</span>
          {subFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FormField
                  label=""
                  registration={register(`subcategories.${index}.name`, {
                    maxLength: { value: 100, message: 'Name cannot exceed 100 characters' },
                  })}
                  error={errors.subcategories?.[index]?.name}
                  placeholder="e.g. Laptops"
                />
              </div>
              <button
                type="button"
                aria-label="Remove subcategory"
                title="Remove subcategory"
                onClick={() => removeSub(index)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <div>
            <Button variant="outline" onClick={() => addSub({ name: '' })}>
              <Plus size={16} /> Add Subcategory
            </Button>
          </div>
        </div>

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
