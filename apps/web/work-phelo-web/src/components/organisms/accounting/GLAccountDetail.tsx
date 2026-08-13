'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { FormField } from '@/components/molecules/shared/FormField';
import { useDeactivateGLAccount, useUpdateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { GLAccountLedger } from '@/components/organisms/accounting/GLAccountLedger';
import type { GLAccount } from '@/types/accounting';

interface GLAccountDetailProps {
  account: GLAccount;
}

interface FormValues {
  name: string;
  description: string;
  allowPosting: boolean;
}

export function GLAccountDetail({ account }: GLAccountDetailProps) {
  const toast = useToast();
  const { mutateAsync: updateAccount, isPending: isUpdating } = useUpdateGLAccount();
  const { mutateAsync: deactivateAccount, isPending: isDeactivating } = useDeactivateGLAccount();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const isPending = isUpdating || isDeactivating;

  useEffect(() => {
    reset({
      name: account.name,
      description: account.description ?? '',
      allowPosting: account.allowPosting,
    });
  }, [account, reset]);

  const save = async (values: FormValues) => {
    try {
      await updateAccount({
        id: account.id,
        name: values.name,
        description: values.description || undefined,
        allowPosting: values.allowPosting,
      });
      toast.success('Account updated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update account'));
    }
  };

  const deactivate = async () => {
    try {
      await deactivateAccount(account.id);
      toast.success('Account deactivated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to deactivate account'));
    }
  };

  return (
    <form className="flex h-full flex-col gap-6" onSubmit={handleSubmit(save)}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{account.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{account.code}</p>
          </div>
          <Badge
            label={account.status}
            variant={account.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <DetailField label="Category" value={account.category} />
          <DetailField label="Normal Balance" value={account.normalBalance} />
          <DetailField
            label="Account Group"
            value={
              account.accountGroup
                ? `${account.accountGroup.code} — ${account.accountGroup.name}`
                : 'Unclassified'
            }
          />
          <DetailField label="Parent Account" value={account.parentAccount?.name ?? '—'} />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-5">
        <h4 className="text-sm font-semibold text-gray-900">Account settings</h4>
        <div className="mt-4 flex flex-col gap-4">
          <FormField
            label="Account Name"
            registration={register('name', { required: 'Account name is required' })}
            error={errors.name}
          />
          <FormField
            label="Description"
            type="textarea"
            rows={4}
            registration={register('description')}
            error={errors.description}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4" {...register('allowPosting')} />
            Allow postings to this account
          </label>
        </div>
      </div>

      <GLAccountLedger accountId={account.id} />

      <div className="mt-auto flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-5">
        {account.status === 'ACTIVE' ? (
          <Button type="button" variant="danger" onClick={deactivate} disabled={isPending}>
            Deactivate
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" isLoading={isUpdating} loadingText="Saving…" disabled={isPending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
