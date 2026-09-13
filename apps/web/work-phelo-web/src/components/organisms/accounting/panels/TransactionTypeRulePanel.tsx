'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  useCreateTransactionTypeRule,
  useGLAccountOptions,
  useSourceTypes,
  useTransactionTypes,
  useUpdateTransactionTypeRule,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import {
  ALL_BUSINESS_ROLE_OPTIONS,
  BUSINESS_ROLE_GROUPS,
  BUSINESS_ROLE_GROUP_OPTIONS,
} from '@/lib/accounting/businessRoles';
import type { TransactionTypeRule } from '@/types/accounting';

type FormValues = {
  transactionTypeId: string;
  sourceType: string;
  role: string;
  accountId: string;
  description: string;
};

const DEFAULTS: FormValues = {
  transactionTypeId: '',
  sourceType: '',
  role: '',
  accountId: '',
  description: '',
};

export function TransactionTypeRulePanel({
  isOpen,
  rule,
  defaultTransactionTypeId,
  onClose,
}: {
  isOpen: boolean;
  rule: TransactionTypeRule | null | undefined;
  /** Pre-fills the Transaction Type field when adding a rule from a group's quick action. */
  defaultTransactionTypeId?: string;
  onClose: () => void;
}) {
  const isEditing = !!rule;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateTransactionTypeRule();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateTransactionTypeRule();
  const { data: transactionTypes = [] } = useTransactionTypes();
  const { data: sourceTypes = [] } = useSourceTypes();
  const { options: accountOptions, isLoading: isLoadingAccounts } = useGLAccountOptions();

  const transactionTypeOptions = useMemo<SearchSelectOption[]>(
    () => transactionTypes.map((t) => ({ value: t.id, label: t.name, sublabel: t.code })),
    [transactionTypes],
  );
  const sourceTypeOptions = useMemo<SearchSelectOption[]>(
    () => sourceTypes.map((s) => ({ value: s.name, label: s.name })),
    [sourceTypes],
  );
  // Scopes the Role list to one header group at a time so 20+ roles aren't dumped in
  // one flat dropdown — cleared whenever the panel closes.
  const [roleGroup, setRoleGroup] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    if (rule)
      reset({
        transactionTypeId: rule.transactionTypeId,
        sourceType: rule.sourceType ?? '',
        role: rule.role ?? '',
        accountId: rule.account.id,
        description: rule.description ?? '',
      });
    else reset({ ...DEFAULTS, transactionTypeId: defaultTransactionTypeId ?? '' });
  }, [isOpen, rule, defaultTransactionTypeId, reset]);

  const close = () => {
    reset(DEFAULTS);
    setRoleGroup('');
    onClose();
  };

  const submit = async (values: FormValues) => {
    try {
      const payload = {
        transactionTypeId: values.transactionTypeId,
        sourceType: values.sourceType || undefined,
        role: values.role || undefined,
        accountId: values.accountId,
        description: values.description || undefined,
      };
      if (rule) await update({ id: rule.id, ...payload });
      else await create(payload);
      toast.success(isEditing ? 'Rule updated successfully' : 'Rule created successfully');
      close();
    } catch (error) {
      toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} rule`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title={isEditing ? 'Update Rule' : 'Add Rule'}
      description="Rules map how a transaction type posts, by source and role, to a GL account."
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
            {isEditing ? 'Save Changes' : 'Add Rule'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          name="transactionTypeId"
          control={control}
          rules={{ required: 'Transaction type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Transaction Type"
              placeholder="Select a transaction type…"
              options={transactionTypeOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.transactionTypeId?.message}
            />
          )}
        />
        <Controller
          name="sourceType"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Source Type"
              placeholder="Select a source type…"
              options={sourceTypeOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <SearchSelect
          label="Role Group"
          placeholder="Scope the role below by group…"
          options={BUSINESS_ROLE_GROUP_OPTIONS}
          value={roleGroup}
          onChange={setRoleGroup}
          showAllOption
          allLabel="All Groups"
        />
        <Controller
          name="role"
          control={control}
          render={({ field }) => {
            const groupRoles = roleGroup
              ? (BUSINESS_ROLE_GROUPS.find((g) => g.key === roleGroup)?.roles ??
                ALL_BUSINESS_ROLE_OPTIONS)
              : ALL_BUSINESS_ROLE_OPTIONS;
            // Keep the currently selected role visible even if it falls outside the
            // scoped group, so switching groups never blanks out an existing pick.
            const selected = ALL_BUSINESS_ROLE_OPTIONS.find((r) => r.value === field.value);
            const options =
              selected && !groupRoles.some((r) => r.value === selected.value)
                ? [...groupRoles, selected]
                : groupRoles;
            return (
              <SearchSelect
                label="Role"
                placeholder="Select a role…"
                options={options}
                value={field.value}
                onChange={field.onChange}
              />
            );
          }}
        />
        <Controller
          name="accountId"
          control={control}
          rules={{ required: 'Account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account"
              placeholder={isLoadingAccounts ? 'Loading accounts…' : 'Select an account…'}
              options={accountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountId?.message}
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
