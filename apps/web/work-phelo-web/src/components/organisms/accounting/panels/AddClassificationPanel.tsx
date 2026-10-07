'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
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
import {
  useAccountClassifications,
  useCreateAccountClassification,
  useUpdateAccountClassification,
} from '@/hooks';
import { suggestClassificationCode } from '@/lib/accounting/accountCodes';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
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
  description: string;
};

const DEFAULTS: FormValues = {
  accountName: '',
  accountType: '',
  accountCode: '',
  cashFlowCategory: '',
  description: '',
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
    getValues,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // The next free code in the type's block, from the classifications already there.
  const accountType = useWatch({ control, name: 'accountType' });
  const currentCode = useWatch({ control, name: 'accountCode' });
  const { data: sameTypeData } = useAccountClassifications(
    accountType ? { category: accountType, limit: 100 } : {},
  );
  const codeSuggestion = useMemo(
    () =>
      !editing && accountType && sameTypeData
        ? suggestClassificationCode(
            accountType,
            sameTypeData.items.filter((c) => c.category === accountType).map((c) => c.code),
          )
        : null,
    [editing, accountType, sameTypeData],
  );
  // Fills the code until the user types their own.
  useEffect(() => {
    if (codeSuggestion?.code && !dirtyFields.accountCode && currentCode !== codeSuggestion.code) {
      setValue('accountCode', codeSuggestion.code);
    }
  }, [codeSuggestion?.code, dirtyFields.accountCode, currentCode, setValue]);

  useEffect(() => {
    if (!isOpen || !editing) return;
    reset({
      accountName: editing.name,
      accountType: editing.category,
      accountCode: editing.code,
      cashFlowCategory: editing.cashFlowCategory ?? '',
      description: editing.description ?? '',
    });
  }, [isOpen, editing, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  // Multi-entry: with the lock on, saving keeps the panel open and asks Continue / Stop. Continue
  // clears the form for the next classification but keeps the account type. Adding only.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => reset({ ...DEFAULTS, accountType: getValues('accountType') }),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      if (editing) {
        await updateClassification({
          id: editing.id,
          name: data.accountName,
          category: data.accountType as GLAccountCategory,
          code: data.accountCode,
          cashFlowCategory: data.cashFlowCategory || undefined,
          description: data.description.trim(),
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
        description: data.description.trim() || undefined,
      });
      toast.success('Classification created successfully');
      entry.finishSave(
        { title: 'Classification Added!', message: `${data.accountName} has been added.` },
        handleClose,
      );
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
      {...entry.panelProps}
      lock={editing ? undefined : entry.panelProps.lock}
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
      <div className="flex flex-col gap-3">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <FormField
            label="Account Code"
            type="number"
            registration={register('accountCode', { required: 'Account code is required' })}
            error={errors.accountCode}
            placeholder="e.g. 1000"
          />
          <FormField
            label="Account Name"
            registration={register('accountName', { required: 'Account name is required' })}
            error={errors.accountName}
            placeholder="e.g. Current Assets"
          />
        </div>

        {codeSuggestion &&
          (codeSuggestion.problem ? (
            <p className="-mt-1 text-xs text-amber-600">{codeSuggestion.problem}</p>
          ) : (
            <p className="-mt-1 text-xs text-gray-500">
              Code suggested from the accounts group ({codeSuggestion.range}).
            </p>
          ))}

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

        <FormField
          label="Description"
          type="textarea"
          rows={2}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />
      </div>
    </SidePanel>
  );
}
