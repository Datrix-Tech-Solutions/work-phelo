'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { GLAccount, GLAccountCategory } from '@/types/accounting';
import { useAccountClassifications, useAccountGroups, useCreateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

/** Fixes the account's place in the hierarchy from a scope already selected in the Chart of
 *  Accounts tree (a classification, a parent account, or another leaf account) — those fields
 *  are hidden and the user only fills in code, name and description. A leaf account always
 *  needs a classification (only the parent account is optional), so a bare account type is not
 *  enough to lock to — there's no "type selected" variant of this. */
export interface LockedAccountScope {
  accountType: GLAccountCategory;
  classificationId: string;
  classificationName: string;
  groupId?: string;
  groupName?: string;
}

interface AddLeafAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;

  initialName?: string;

  /** Pre-selects the account type each time the panel opens (e.g. equity for retained earnings),
   *  but leaves it and the rest of the hierarchy editable. Mutually exclusive with `lockedScope`. */
  initialAccountType?: GLAccountCategory;

  /** Creating "here": hides the Type/Classification/Parent Account fields and fixes them to
   *  this scope instead. */
  lockedScope?: LockedAccountScope;

  onCreated?: (account: GLAccount) => void;
}

type FormValues = {
  accountCode: string;
  accountName: string;
  accountType: GLAccountCategory | '';
  classificationId: string;
  parentAccountId: string;
  description: string;
};

const DEFAULTS: FormValues = {
  accountCode: '',
  accountName: '',
  accountType: '',
  classificationId: '',
  parentAccountId: '',
  description: '',
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
  initialAccountType,
  lockedScope,
  onCreated,
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

  // Seed the name (and, when creating "here", the whole locked hierarchy) each time the panel opens.
  useEffect(() => {
    if (isOpen) {
      reset({
        ...DEFAULTS,
        accountName: initialName ?? '',
        accountType: lockedScope?.accountType ?? initialAccountType ?? '',
        classificationId: lockedScope?.classificationId ?? '',
        parentAccountId: lockedScope?.groupId ?? '',
      });
    }
  }, [isOpen, initialName, initialAccountType, lockedScope, reset]);

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

  // These resets exist for the freely-editable form; a locked scope never changes accountType
  // or classificationId out from under itself, so they'd otherwise wipe the locked selection
  // right after the effect above sets it.
  useEffect(() => {
    if (lockedScope) return;
    setValue('classificationId', '');
  }, [accountType, lockedScope, setValue]);

  useEffect(() => {
    if (lockedScope) return;
    setValue('parentAccountId', '');
  }, [classificationId, lockedScope, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const account = await createAccount({
        code: data.accountCode,
        name: data.accountName,
        classificationId: data.classificationId,
        accountGroupId: data.parentAccountId || undefined,
        description: data.description || undefined,
      });
      toast.success('Account created successfully');
      onCreated?.(account);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create account'));
    }
  };

  const lockedSummary = lockedScope
    ? [
        TYPE_OPTIONS.find((o) => o.value === lockedScope.accountType)?.label,
        lockedScope.classificationName,
        lockedScope.groupName,
      ]
        .filter(Boolean)
        .join(' > ')
    : null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Account"
      description={
        lockedSummary
          ? `New account under ${lockedSummary}.`
          : 'Add a new posting account under a classification, optionally within a parent account.'
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

        <FormField
          label="Description (optional)"
          type="textarea"
          rows={2}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />

        {lockedScope ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <span className="font-medium text-gray-500">Placed under: </span>
            {lockedSummary}
          </div>
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
                render={({ field }) => (
                  <SearchSelect
                    label="Parent Account (optional)"
                    placeholder={
                      isLoadingGroups ? 'Loading…' : 'None — post directly under classification'
                    }
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
