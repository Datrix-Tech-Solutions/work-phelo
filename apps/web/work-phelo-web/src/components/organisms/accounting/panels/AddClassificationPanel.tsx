'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  AccountClassification,
  CASH_FLOW_CATEGORY_OPTIONS,
  CashFlowCategory,
  GLAccountCategory,
} from '@/types/accounting';
import { useCreateAccountClassification, useUpdateAccountClassification } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddClassificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editing?: AccountClassification;
}

type FormValues = {
  accountName: string;
  accountType: GLAccountCategory | '';
  accountCode: string;
  cashFlowCategory: CashFlowCategory | '';
};

const DEFAULTS: FormValues = {
  accountName: '',
  accountType: '',
  accountCode: '',
  cashFlowCategory: '',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

export function AddClassificationPanel({ isOpen, onClose, editing }: AddClassificationPanelProps) {
  const toast = useToast();
  const { mutateAsync: createClassification, isPending: isCreating } =
    useCreateAccountClassification();
  const { mutateAsync: updateClassification, isPending: isUpdating } =
    useUpdateAccountClassification();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen || !editing) return;
    reset({
      accountName: editing.name,
      accountType: editing.category,
      accountCode: editing.code,
      cashFlowCategory: editing.cashFlowCategory ?? '',
    });
  }, [isOpen, editing, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      if (editing) {
        await updateClassification({
          id: editing.id,
          name: data.accountName,
          category: data.accountType as GLAccountCategory,
          code: data.accountCode,
          cashFlowCategory: data.cashFlowCategory || undefined,
        });
        toast.success('Classification updated successfully');
        handleClose();
        return;
      }
      await createClassification({
        name: data.accountName,
        category: data.accountType as GLAccountCategory,
        code: data.accountCode,
        cashFlowCategory: data.cashFlowCategory || undefined,
      });
      toast.success('Classification created successfully');
      handleClose();
    } catch (err) {
      toast.error(
        extractError(
          err,
          editing ? 'Failed to update classification' : 'Failed to create classification',
        ),
      );
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={editing ? 'Edit Classification' : 'Add Classification'}
      description={
        editing
          ? 'Update this classification in the chart of accounts.'
          : 'Add a new classification for grouping accounts in the chart of accounts.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {editing ? 'Update Classification' : 'Add Classification'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Current Assets"
        />

        <Controller
          name="accountType"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountType?.message}
            />
          )}
        />

        <FormField
          label="Account Code"
          type="number"
          registration={register('accountCode', { required: 'Account code is required' })}
          error={errors.accountCode}
          placeholder="e.g. 1000"
        />

        <Controller
          name="cashFlowCategory"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Cash Flow Category (optional)"
              placeholder="Defaults per account — set here to apply to the whole classification"
              options={CASH_FLOW_CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
