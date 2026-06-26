'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountType, AccountStatus } from '@/types/accounting';

interface RegisterAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  accountCode: string;
  accountName: string;
  type: AccountType | '';
  parentAccount: string;
  currency: string;
  status: AccountStatus | '';
  description: string;
};

const DEFAULTS: FormValues = {
  accountCode: '',
  accountName: '',
  type: '',
  parentAccount: '',
  currency: '',
  status: '',
  description: '',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'Asset', label: 'Asset' },
  { value: 'Liability', label: 'Liability' },
  { value: 'Equity', label: 'Equity' },
  { value: 'Revenue', label: 'Revenue' },
  { value: 'Expense', label: 'Expense' },
];

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

// TODO: populate from chart of accounts API
const PARENT_ACCOUNT_OPTIONS: SearchSelectOption[] = [];

// TODO: populate from currencies API
const CURRENCY_OPTIONS: SearchSelectOption[] = [
  { value: 'GHS', label: 'Ghana Cedi (GHS)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
];

export function RegisterAccountPanel({ isOpen, onClose }: RegisterAccountPanelProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Register Account"
      description="Add a new account to the chart of accounts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Register Account</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Code"
          type="number"
          registration={register('accountCode', { required: 'Account code is required' })}
          error={errors.accountCode}
          placeholder="e.g. 1001"
        />

        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Cash and Cash Equivalents"
        />

        <Controller
          name="type"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />

        <Controller
          name="parentAccount"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Parent Account"
              placeholder="Select parent account…"
              options={PARENT_ACCOUNT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={CURRENCY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          rules={{ required: 'Status is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Status"
              placeholder="Select status…"
              options={STATUS_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.status?.message}
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
      </div>
    </SidePanel>
  );
}
