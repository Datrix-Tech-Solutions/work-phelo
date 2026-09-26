'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  AccountGroup,
  CASH_FLOW_CATEGORY_OPTIONS,
  CashFlowCategory,
  GLAccountCategory,
} from '@/types/accounting';
import {
  useAccountClassifications,
  useAccountingCurrencyOptions,
  useCreateAccountGroup,
  useUpdateAccountGroup,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddParentAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editing?: AccountGroup;
}

type FormValues = {
  accountCode: string;
  accountName: string;
  accountType: GLAccountCategory | '';
  classificationId: string;
  // Not connected to any backend field yet — the account group endpoint has no
  // currency/status/description fields. Collected here for later, not submitted.
  currency: string;
  status: string;
  description: string;
  cashFlowCategory: CashFlowCategory | '';
};

const DEFAULTS: FormValues = {
  accountCode: '',
  accountName: '',
  accountType: '',
  classificationId: '',
  currency: '',
  status: '',
  description: '',
  cashFlowCategory: '',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export function AddParentAccountPanel({ isOpen, onClose, editing }: AddParentAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: createGroup, isPending: isCreating } = useCreateAccountGroup();
  const { mutateAsync: updateGroup, isPending: isUpdating } = useUpdateAccountGroup();
  const isPending = isCreating || isUpdating;
  const { options: currencyOptions } = useAccountingCurrencyOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const accountType = useWatch({ control, name: 'accountType' });

  const { data: classificationsData, isLoading: isLoadingClassifications } =
    useAccountClassifications(accountType ? { category: accountType, isActive: true } : {});
  const classificationOptions: SearchSelectOption[] = accountType
    ? (classificationsData?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
    : [];

  useEffect(() => {
    if (!isOpen || !editing) return;
    reset({
      ...DEFAULTS,
      accountCode: editing.code,
      accountName: editing.name,
      accountType: editing.classification.category,
      classificationId: editing.classificationId,
      status: editing.isActive ? 'Active' : 'Inactive',
      cashFlowCategory: editing.cashFlowCategory ?? '',
    });
  }, [isOpen, editing, reset]);

  useEffect(() => {
    if (editing && accountType === editing.classification.category) return;
    setValue('classificationId', '');
  }, [accountType, editing, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      if (editing) {
        await updateGroup({
          id: editing.id,
          code: data.accountCode,
          name: data.accountName,
          classificationId: data.classificationId,
          cashFlowCategory: data.cashFlowCategory || undefined,
          ...(data.status ? { isActive: data.status === 'Active' } : {}),
        });
        toast.success('Parent account updated successfully');
        handleClose();
        return;
      }
      await createGroup({
        code: data.accountCode,
        name: data.accountName,
        classificationId: data.classificationId,
        cashFlowCategory: data.cashFlowCategory || undefined,
      });
      toast.success('Parent account created successfully');
      handleClose();
    } catch (err) {
      toast.error(
        extractError(
          err,
          editing ? 'Failed to update parent account' : 'Failed to create parent account',
        ),
      );
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={editing ? 'Edit Parent Account' : 'Add Parent Account'}
      description={
        editing
          ? 'Update this parent account in the chart of accounts.'
          : 'Add a new parent account under a classification in the chart of accounts.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {editing ? 'Update Parent Account' : 'Add Parent Account'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Code"
          type="number"
          registration={register('accountCode', { required: 'Account code is required' })}
          error={errors.accountCode}
          placeholder="e.g. 1100"
        />

        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Bank Accounts"
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

        {accountType && (
          <Controller
            name="classificationId"
            control={control}
            rules={{ required: 'Classification is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Classification"
                placeholder={isLoadingClassifications ? 'Loading…' : 'Select classification…'}
                options={classificationOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.classificationId?.message}
              />
            )}
          />
        )}

        <Controller
          name="currency"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Status"
              placeholder="Select status…"
              options={STATUS_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <FormField
          label="Description"
          type="textarea"
          rows={4}
          registration={register('description')}
          error={errors.description}
          placeholder="Provide a brief description of this account…"
        />

        <Controller
          name="cashFlowCategory"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Cash Flow Category (optional)"
              placeholder="Defaults from the classification, or Operating"
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
