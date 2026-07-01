'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';

interface AddAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  accountName: string;
  accountType: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  bankBranch: string;
};

const DEFAULTS: FormValues = {
  accountName: '',
  accountType: '',
  bankName: '',
  bankCode: '',
  accountNumber: '',
  bankBranch: '',
};

const ACCOUNT_TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'Current', label: 'Current' },
  { value: 'Savings', label: 'Savings' },
  { value: 'Fixed Deposit', label: 'Fixed Deposit' },
  { value: 'Petty Cash', label: 'Petty Cash' },
  { value: 'Other', label: 'Other' },
];

export function AddAccountPanel({ isOpen, onClose }: AddAccountPanelProps) {
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
      title="Add Account"
      description="Register a new bank account to your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Add Account</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Main Operating Account"
        />

        <Controller
          name="accountType"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={ACCOUNT_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountType?.message}
            />
          )}
        />

        <FormField
          label="Bank Name"
          registration={register('bankName', { required: 'Bank name is required' })}
          error={errors.bankName}
          placeholder="e.g. Ghana Commercial Bank"
        />

        <FormField
          label="Bank Code"
          type="number"
          registration={register('bankCode', { required: 'Bank code is required' })}
          error={errors.bankCode}
          placeholder="e.g. 030100"
        />

        <FormField
          label="Account Number"
          type="number"
          registration={register('accountNumber', { required: 'Account number is required' })}
          error={errors.accountNumber}
          placeholder="e.g. 1234567890"
        />

        <FormField
          label="Bank Branch"
          registration={register('bankBranch', { required: 'Bank branch is required' })}
          error={errors.bankBranch}
          placeholder="e.g. Accra Main Branch"
        />
      </div>
    </SidePanel>
  );
}
