'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { GLAccount, GLAccountCategory } from '@/types/accounting';
import { useAccountClassifications, useAccountGroups, useCreateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface FixedGroup {
  accountType: GLAccountCategory;
  classificationId: string;
  groupId: string;
  /** e.g. "Asset > Current Assets > Cash and Bank" */
  label: string;
}

interface AddLeafAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;

  initialName?: string;

  onCreated?: (account: GLAccount) => void;

  /** When set, Account Type/Classification/Parent Account are fixed to this group
   *  instead of asked — used when the account must always live in one specific place
   *  (e.g. a Cash/Bank account, always under Asset > Current Assets > Cash and Bank). */
  fixedGroup?: FixedGroup;
}

type FormValues = {
  accountCode: string;
  accountName: string;
  accountType: GLAccountCategory | '';
  classificationId: string;
  parentAccountId: string;
};

const DEFAULTS: FormValues = {
  accountCode: '',
  accountName: '',
  accountType: '',
  classificationId: '',
  parentAccountId: '',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

export function AddLeafAccountPanel({
  isOpen,
  onClose,
  initialName,
  onCreated,
  fixedGroup,
}: AddLeafAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: createAccount, isPending } = useCreateGLAccount();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // Seed the name from whatever the caller had already typed each time the panel opens —
  // and pre-fill/lock the type-classification-group chain when it's fixed by the caller.
  useEffect(() => {
    if (!isOpen) return;
    reset({
      ...DEFAULTS,
      accountName: initialName ?? '',
      ...(fixedGroup
        ? {
            accountType: fixedGroup.accountType,
            classificationId: fixedGroup.classificationId,
            parentAccountId: fixedGroup.groupId,
          }
        : {}),
    });
  }, [isOpen, initialName, fixedGroup, reset]);

  const accountType = useWatch({ control, name: 'accountType' });
  const classificationId = useWatch({ control, name: 'classificationId' });

  const { data: classificationsData, isLoading: isLoadingClassifications } =
    useAccountClassifications(accountType ? { category: accountType, isActive: true } : {});
  const classificationOptions: SearchSelectOption[] = accountType
    ? (classificationsData?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
    : [];

  const { data: groupsData, isLoading: isLoadingGroups } = useAccountGroups(
    classificationId ? { classificationId, isActive: true } : {},
  );
  const parentAccountOptions: SearchSelectOption[] = classificationId
    ? (groupsData?.items ?? []).map((g) => ({ value: g.id, label: g.name }))
    : [];

  useEffect(() => {
    if (fixedGroup) return;
    setValue('classificationId', '');
  }, [accountType, fixedGroup, setValue]);

  useEffect(() => {
    if (fixedGroup) return;
    setValue('parentAccountId', '');
  }, [classificationId, fixedGroup, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const account = await createAccount({
        code: data.accountCode,
        name: data.accountName,
        accountGroupId: data.parentAccountId,
      });
      toast.success('Account created successfully');
      onCreated?.(account);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create account'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={fixedGroup ? 'Add Cash/Bank Account' : 'Add Leaf Account'}
      description={
        fixedGroup
          ? `Adds a new posting account under ${fixedGroup.label}.`
          : 'Add a new posting account under a parent account in the chart of accounts.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Add Leaf Account
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

        {fixedGroup ? (
          <Input label="Account Group" readOnly value={fixedGroup.label} />
        ) : (
          <>
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

            {classificationId && (
              <Controller
                name="parentAccountId"
                control={control}
                rules={{ required: 'Parent account is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Parent Account"
                    placeholder={isLoadingGroups ? 'Loading…' : 'Select parent account…'}
                    options={parentAccountOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.parentAccountId?.message}
                  />
                )}
              />
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
