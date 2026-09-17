'use client';

import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashAccountKind, GLAccountCategory } from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCreateCashAccount,
  useCreateGLAccount,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface FixedGroup {
  accountType: GLAccountCategory;
  classificationId: string;
  groupId: string;
  /** e.g. "Current Assets > Cash and Bank" */
  label: string;
}

interface AddCashAndBankAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the new leaf account is filed — always fixed for a Cash/Bank account,
   *  never asked, since it always lives under Asset > Current Assets > Cash and Bank. */
  fixedGroup?: FixedGroup;
}

type FormValues = {
  accountCode: string;
  name: string;
  accountKind: AccountingCashAccountKind | '';
  currency: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  description: string;
};

const DEFAULTS: FormValues = {
  accountCode: '',
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

/** One form that creates both halves of a Cash/Bank account at once: the leaf GL
 *  account (filed under the fixed Cash and Bank group) and the Cash Account record
 *  linked to it — so it's immediately usable for payments the moment it's saved,
 *  instead of a leaf account sitting incomplete until a separate step finishes it. */
export function AddCashAndBankAccountPanel({
  isOpen,
  onClose,
  fixedGroup,
}: AddCashAndBankAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: createGLAccount, isPending: isCreatingGLAccount } = useCreateGLAccount();
  const { mutateAsync: createCashAccount, isPending: isCreatingCashAccount } =
    useCreateCashAccount();
  const isPending = isCreatingGLAccount || isCreatingCashAccount;
  const { options: currencyOptions, isLoading: isLoadingCurrencies } =
    useAccountingCurrencyOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
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
    if (!fixedGroup) return;
    let glAccountId: string;
    try {
      const glAccount = await createGLAccount({
        code: data.accountCode,
        name: data.name,
        accountGroupId: fixedGroup.groupId,
      });
      glAccountId = glAccount.id;
    } catch (err) {
      toast.error(extractError(err, 'Failed to create account'));
      return;
    }

    try {
      await createCashAccount({
        name: data.name,
        accountKind: data.accountKind as AccountingCashAccountKind,
        currency: data.currency,
        glAccountId,
        bankName: data.bankName || undefined,
        accountNumber: data.accountNumber || undefined,
        branch: data.branch || undefined,
        description: data.description || undefined,
      });
      toast.success('Cash/Bank account created successfully');
      handleClose();
    } catch (err) {
      toast.error(
        extractError(
          err,
          'The account was created but its cash/bank details could not be saved — find it in the list marked "Setup Required" to finish.',
        ),
      );
      handleClose();
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cash/Bank Account"
      description={
        fixedGroup
          ? `Creates a new account under ${fixedGroup.label}, ready to use for payments.`
          : undefined
      }
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
        {fixedGroup && <Input label="Account Group" readOnly value={fixedGroup.label} />}

        <FormField
          label="Account Code"
          type="number"
          registration={register('accountCode', { required: 'Account code is required' })}
          error={errors.accountCode}
          placeholder="e.g. 1101"
        />

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
