'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { GLAccount, GLAccountCategory } from '@/types/accounting';
import { useAccountClassifications, useAccountGroups, useUpdateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface EditLeafAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  account: GLAccount;
}

type FormValues = {
  accountCode: string;
  accountName: string;
  accountType: GLAccountCategory | '';
  classificationId: string;
  accountGroupId: string;
  description: string;
  allowPosting: boolean;
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

export function EditLeafAccountPanel({ isOpen, onClose, account }: EditLeafAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateAccount, isPending } = useUpdateGLAccount();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>();

  const accountType = useWatch({ control, name: 'accountType' });
  const classificationId = useWatch({ control, name: 'classificationId' });

  const { data: allGroupsData, isLoading: isLoadingAllGroups } = useAccountGroups();
  const { data: classificationsData, isLoading: isLoadingClassifications } =
    useAccountClassifications(accountType ? { category: accountType, isActive: true } : {});
  const { data: groupsData, isLoading: isLoadingGroups } = useAccountGroups(
    classificationId ? { classificationId, isActive: true } : {},
  );

  const classificationOptions: SearchSelectOption[] = accountType
    ? (classificationsData?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
    : [];
  const groupOptions: SearchSelectOption[] = classificationId
    ? (groupsData?.items ?? []).map((g) => ({ value: g.id, label: g.name }))
    : [];

  // Prefill once the account's group (and so its classification) can be resolved.
  useEffect(() => {
    if (!isOpen || isLoadingAllGroups) return;
    const group = (allGroupsData?.items ?? []).find((g) => g.id === account.accountGroupId);
    reset({
      accountCode: account.code,
      accountName: account.name,
      accountType: account.category,
      classificationId: group?.classificationId ?? '',
      accountGroupId: account.accountGroupId ?? '',
      description: account.description ?? '',
      allowPosting: account.allowPosting,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, account.id, isLoadingAllGroups, reset]);

  const onSubmit = async (data: FormValues) => {
    try {
      await updateAccount({
        id: account.id,
        code: data.accountCode,
        name: data.accountName,
        accountGroupId: data.accountGroupId,
        description: data.description,
        allowPosting: data.allowPosting,
      });
      toast.success('Account updated');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Unable to update account'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${account.name}`}
      description="Update this posting account in the chart of accounts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Update Account
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
          placeholder="e.g. 1101"
        />

        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Ecobank"
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
              onChange={(value) => {
                field.onChange(value);
                setValue('classificationId', '');
                setValue('accountGroupId', '');
              }}
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
                onChange={(value) => {
                  field.onChange(value);
                  setValue('accountGroupId', '');
                }}
                error={errors.classificationId?.message}
              />
            )}
          />
        )}

        {classificationId && (
          <Controller
            name="accountGroupId"
            control={control}
            rules={{ required: 'Parent account is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Parent Account"
                placeholder={isLoadingGroups ? 'Loading…' : 'Select parent account…'}
                options={groupOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.accountGroupId?.message}
              />
            )}
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={4}
          registration={register('description')}
          error={errors.description}
          placeholder="Provide a brief description of this account…"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" {...register('allowPosting')} />
          Allow postings to this account
        </label>
      </div>
    </SidePanel>
  );
}
