'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  CASH_FLOW_CATEGORY_OPTIONS,
  CashFlowCategory,
  GLAccount,
  GLAccountCategory,
} from '@/types/accounting';
import {
  useAccountClassifications,
  useAccountGroups,
  useCreateGLAccount,
  useGLAccounts,
} from '@/hooks';
import { suggestAccountCode } from '@/lib/accounting/accountCodes';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
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
  cashFlowCategory: CashFlowCategory | '';
};

const DEFAULTS: FormValues = {
  accountCode: '',
  accountName: '',
  accountType: '',
  classificationId: '',
  parentAccountId: '',
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
    getValues,
    formState: { errors, dirtyFields },
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

  // The next free code inside the parent account's range (or the classification's, when there
  // is no parent account), from the accounts already there. Fills the code until the user types
  // their own.
  const parentAccountId = useWatch({ control, name: 'parentAccountId' });
  const currentCode = useWatch({ control, name: 'accountCode' });
  const { data: allGroupsData } = useAccountGroups(
    classificationId ? { classificationId, limit: 100 } : {},
  );
  const { data: allAccounts } = useGLAccounts();
  const classificationCode = classificationsData?.items.find(
    (c) => c.id === classificationId,
  )?.code;
  const codeSuggestion = useMemo(() => {
    if (!classificationId || !classificationCode || !allGroupsData || !allAccounts) return null;
    const groups = allGroupsData.items.filter((g) => g.classificationId === classificationId);
    const parent = parentAccountId ? groups.find((g) => g.id === parentAccountId) : undefined;
    if (parentAccountId && !parent) return null;
    const used = allAccounts
      .filter((a) =>
        parent
          ? a.accountGroupId === parent.id
          : a.classificationId === classificationId && !a.accountGroupId,
      )
      .map((a) => a.code);
    return suggestAccountCode(
      parent ? parent.code : classificationCode,
      used,
      parent ? [] : groups.map((g) => g.code),
    );
  }, [classificationId, classificationCode, parentAccountId, allGroupsData, allAccounts]);
  useEffect(() => {
    if (codeSuggestion?.code && !dirtyFields.accountCode && currentCode !== codeSuggestion.code) {
      setValue('accountCode', codeSuggestion.code);
    }
  }, [codeSuggestion?.code, dirtyFields.accountCode, currentCode, setValue]);

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

  // Multi-entry: with the lock on, saving keeps the panel open and asks Continue / Stop. Continue
  // clears the code, name and description for the next account but keeps where it is going: the
  // type, classification, parent account and cash flow category. Not offered when the panel is opened from another
  // form that takes the new account back (onCreated).
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () =>
      reset({
        ...DEFAULTS,
        accountType: getValues('accountType'),
        classificationId: getValues('classificationId'),
        parentAccountId: getValues('parentAccountId'),
        cashFlowCategory: getValues('cashFlowCategory'),
      }),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const account = await createAccount({
        code: data.accountCode,
        name: data.accountName,
        classificationId: data.classificationId,
        accountGroupId: data.parentAccountId || undefined,
        description: data.description || undefined,
        cashFlowCategory: data.cashFlowCategory || undefined,
      });
      toast.success('Account created successfully');
      onCreated?.(account);
      entry.finishSave(
        { title: 'Account Added!', message: `${data.accountName} has been added.` },
        handleClose,
      );
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
      {...entry.panelProps}
      lock={onCreated ? undefined : entry.panelProps.lock}
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
      <div className="flex flex-col gap-3">
        {/* The same three fields whether the form is opened on its own or from a spot in the tree.
            From the tree they come pre-filled and locked, so the account lands exactly there. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                disabled={!!lockedScope}
                error={errors.accountType?.message}
              />
            )}
          />
          <Controller
            name="classificationId"
            control={control}
            rules={{ required: 'Classification is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Classification"
                placeholder={
                  !accountType
                    ? 'Select a type first…'
                    : isLoadingClassifications
                      ? 'Loading…'
                      : 'Select classification…'
                }
                options={classificationOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={!!lockedScope || !accountType}
                error={errors.classificationId?.message}
              />
            )}
          />
          <Controller
            name="parentAccountId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Parent Account (optional)"
                placeholder={
                  !classificationId
                    ? 'Select a classification first…'
                    : isLoadingGroups
                      ? 'Loading…'
                      : 'None — post directly under classification'
                }
                options={parentAccountOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={!!lockedScope || !classificationId}
                error={errors.parentAccountId?.message}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
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
              placeholder="Defaults from the parent account or classification"
              options={CASH_FLOW_CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <FormField
          label="Description (optional)"
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
