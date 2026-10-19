'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashAccountKind } from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCashAccounts,
  useCreateCashAccount,
  useGLAccounts,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCashAndBankAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  glAccountId: string;
  name: string;
  accountKind: AccountingCashAccountKind | '';
  currency: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  description: string;
};

const DEFAULTS: FormValues = {
  glAccountId: '',
  name: '',
  accountKind: '',
  currency: '',
  bankName: '',
  accountNumber: '',
  branch: '',
  description: '',
};

const KIND_OPTIONS: SearchSelectOption[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'OTHER', label: 'Other' },
];

/** Creates a Cash/Bank account record and links it to an existing leaf asset account. The leaf account is picked, not created here, so it doesn't matter which group it was
 *  filed under — only that it is an active, posting-enabled account that nothing else is using. */
export function AddCashAndBankAccountPanel({ isOpen, onClose }: AddCashAndBankAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCashAccount, isPending } = useCreateCashAccount();
  const { options: currencyOptions, isLoading: isLoadingCurrencies } =
    useAccountingCurrencyOptions();
  const { data: glAccounts = [], isLoading: isLoadingGLAccounts } = useGLAccounts({
    category: 'ASSET',
  });
  const { data: cashAccounts = [] } = useCashAccounts();

  const glAccountOptions = useMemo<SearchSelectOption[]>(() => {
    const linked = new Set(cashAccounts.map((c) => c.glAccountId));
    const parents = new Set(glAccounts.map((g) => g.parentAccountId).filter(Boolean));
    return glAccounts
      .filter(
        (g) => g.status === 'ACTIVE' && g.allowPosting && !parents.has(g.id) && !linked.has(g.id),
      )
      .map((g) => ({ value: g.id, label: `${g.code} – ${g.name}` }));
  }, [glAccounts, cashAccounts]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const accountKind = useWatch({ control, name: 'accountKind' });

  useEffect(() => {
    if (isOpen) reset(DEFAULTS);
  }, [isOpen, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createCashAccount({
        name: data.name,
        accountKind: data.accountKind as AccountingCashAccountKind,
        currency: data.currency,
        glAccountId: data.glAccountId,
        bankName: data.bankName || undefined,
        accountNumber: data.accountNumber || undefined,
        branch: data.branch || undefined,
        description: data.description || undefined,
      });
      toast.success('Cash/Bank account created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create the cash/bank account'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cash/Bank Account"
      description="Link a bank, cash or mobile money account to a leaf asset account so it can be used for payments and receipts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Account
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Controller
            name="glAccountId"
            control={control}
            rules={{ required: 'Choose the account to link' }}
            render={({ field }) => (
              <SearchSelect
                label="Linked Account"
                placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select an asset account…'}
                options={glAccountOptions}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  // Start the name from the account's own name, unless one was already typed.
                  if (!getValues('name')) {
                    const picked = glAccounts.find((g) => g.id === value);
                    if (picked) setValue('name', picked.name);
                  }
                }}
                error={errors.glAccountId?.message}
              />
            )}
          />
          {!isLoadingGLAccounts && glAccountOptions.length === 0 && (
            <span className="text-xs text-amber-700">
              No free asset account. Create one in the Chart of Accounts first.
            </span>
          )}
        </div>

        <FormField
          label="Account Name"
          registration={register('name', { required: 'Account name is required' })}
          error={errors.name}
          placeholder="e.g. Ecobank Current Account"
        />

        <Controller
          name="accountKind"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={KIND_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountKind?.message}
            />
          )}
        />

        <div className="flex flex-col gap-1">
          <Controller
            name="currency"
            control={control}
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Currency"
                placeholder={isLoadingCurrencies ? 'Loading…' : 'Select currency…'}
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.currency?.message}
              />
            )}
          />
          {!isLoadingCurrencies && currencyOptions.length === 0 && (
            <span className="text-xs text-amber-700">
              No active currency is configured. Add one under Settings &gt; Currency first.
            </span>
          )}
        </div>

        {accountKind === 'BANK' && (
          <>
            <FormField
              label="Bank Name"
              registration={register('bankName')}
              error={errors.bankName}
              placeholder="e.g. Ecobank Ghana"
            />
            <FormField
              label="Branch"
              registration={register('branch')}
              error={errors.branch}
              placeholder="e.g. Accra Main"
            />
          </>
        )}

        {accountKind !== 'CASH' && (
          <FormField
            label="Account Number"
            registration={register('accountNumber')}
            error={errors.accountNumber}
            placeholder="Masked identifier, e.g. ****1234"
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional notes about this account"
        />
      </div>
    </SidePanel>
  );
}
