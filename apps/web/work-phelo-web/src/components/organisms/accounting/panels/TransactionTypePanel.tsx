'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateTransactionType, useSourceTypes, useUpdateTransactionType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { TransactionTypeCategory, TransactionTypeDefinition } from '@/types/accounting';

const CATEGORY_OPTIONS: SearchSelectOption[] = [
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'RECEIVABLE', label: 'Receivable' },
  { value: 'PAYABLE', label: 'Payable' },
  { value: 'NONE', label: 'None' },
];

const ALLOWED_DOCUMENT_OPTIONS: SearchSelectOption[] = [];

type FormValues = {
  name: string;
  code: string;
  category: TransactionTypeCategory | '';
  allowedDocument: string;
  source: string;
  description: string;
};

const DEFAULTS: FormValues = {
  name: '',
  code: '',
  category: '',
  allowedDocument: '',
  source: '',
  description: '',
};

export function TransactionTypePanel({
  transactionType,
  onClose,
}: {
  transactionType: TransactionTypeDefinition | null | undefined;
  onClose: () => void;
}) {
  const isEditing = transactionType !== null && transactionType !== undefined;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateTransactionType();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateTransactionType();
  const { data: sourceTypes = [] } = useSourceTypes();
  const sourceOptions = useMemo<SearchSelectOption[]>(
    () => sourceTypes.map((s) => ({ value: s.name, label: s.name })),
    [sourceTypes],
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (transactionType)
      reset({
        name: transactionType.name,
        code: transactionType.code,
        category: transactionType.category,
        allowedDocument: transactionType.allowedDocument ?? '',
        source: transactionType.source ?? '',
        description: transactionType.description ?? '',
      });
    else reset(DEFAULTS);
  }, [transactionType, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    try {
      const payload = {
        name: values.name,
        code: values.code,
        category: values.category as TransactionTypeCategory,
        allowedDocument: values.allowedDocument || undefined,
        source: values.source || undefined,
        description: values.description || undefined,
      };
      if (transactionType) await update({ id: transactionType.id, ...payload });
      else await create(payload);
      toast.success(
        isEditing
          ? 'Transaction type updated successfully'
          : 'Transaction type created successfully',
      );
      close();
    } catch (error) {
      toast.error(
        extractError(error, `Unable to ${isEditing ? 'update' : 'create'} transaction type`),
      );
    }
  };

  return (
    <SidePanel
      isOpen={transactionType !== undefined}
      onClose={close}
      title={isEditing ? 'Update Transaction Type' : 'Add Transaction Type'}
      description="Transaction types classify cashbook and journal entries for reporting and posting."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isCreating || isUpdating}>
            Cancel
          </Button>
          <Button
            isLoading={isCreating || isUpdating}
            loadingText="Saving…"
            onClick={handleSubmit(submit)}
          >
            {isEditing ? 'Save Changes' : 'Add Transaction Type'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Name"
          registration={register('name', {
            required: 'Name is required',
            maxLength: { value: 160, message: 'Name must be 160 characters or fewer' },
          })}
          error={errors.name}
          placeholder="e.g. Customer Receipt"
        />
        <FormField
          label="Code"
          registration={register('code', {
            required: 'Code is required',
            maxLength: { value: 30, message: 'Code must be 30 characters or fewer' },
            setValueAs: (value: string) => value.toUpperCase(),
          })}
          error={errors.code}
          placeholder="e.g. CUST-RCPT"
        />
        <Controller
          name="category"
          control={control}
          rules={{ required: 'Category is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Category"
              placeholder="Select a category…"
              options={CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.category?.message}
            />
          )}
        />
        <Controller
          name="allowedDocument"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Allowed Document"
              placeholder="No document types configured yet"
              options={ALLOWED_DOCUMENT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Source"
              placeholder="Select a source…"
              options={sourceOptions}
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
            maxLength: { value: 500, message: 'Description must be 500 characters or fewer' },
          })}
          error={errors.description}
          placeholder="Optional description"
        />
      </div>
    </SidePanel>
  );
}
