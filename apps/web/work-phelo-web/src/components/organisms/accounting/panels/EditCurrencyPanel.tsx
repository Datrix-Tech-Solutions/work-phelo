'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { AccountingCurrency } from '@/types/accounting';
import { useUpdateAccountingConfig, useUpdateAccountingCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';

interface EditCurrencyPanelProps {
  currency: AccountingCurrency | null;
  baseCurrency: string | null | undefined;
  onClose: () => void;
}

interface FormValues {
  name: string;
  symbol: string;
  isBaseCurrency: boolean;
}

const DEFAULTS: FormValues = {
  name: '',
  symbol: '',
  isBaseCurrency: false,
};

export function EditCurrencyPanel({ currency, baseCurrency, onClose }: EditCurrencyPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateCurrency, isPending: isSavingCurrency } =
    useUpdateAccountingCurrency();
  const { mutateAsync: updateConfig, isPending: isSettingBase } = useUpdateAccountingConfig();
  const isPending = isSavingCurrency || isSettingBase;

  const isCurrentBase = !!currency && currency.code === baseCurrency;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (currency) reset({ name: currency.name, symbol: currency.symbol ?? '', isBaseCurrency: isCurrentBase });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    if (!currency) return;
    try {
      await updateCurrency({
        id: currency.id,
        name: data.name,
        symbol: data.symbol || undefined,
      });

      if (data.isBaseCurrency && !isCurrentBase) {
        await updateConfig({ baseCurrency: currency.code });
      }

      toast.success('Currency updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update currency'));
    }
  };

  return (
    <SidePanel
      isOpen={!!currency}
      onClose={handleClose}
      title="Update Currency"
      description="Update the details for this currency."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <FormField
          label="Currency Name"
          registration={register('name', { required: 'Currency name is required' })}
          error={errors.name}
          placeholder="e.g. Ghana Cedi"
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">ISO Code</label>
          <div
            className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}
          >
            {currency?.code}
          </div>
          <p className="text-xs text-gray-400">ISO code cannot be changed after creation.</p>
        </div>

        <FormField
          label="Symbol"
          registration={register('symbol')}
          error={errors.symbol}
          placeholder="e.g. ₵"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-isBaseCurrency"
            {...register('isBaseCurrency')}
            disabled={isCurrentBase}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 disabled:opacity-60"
          />
          <label htmlFor="edit-isBaseCurrency" className="text-sm text-gray-700">
            Set as base currency
          </label>
        </div>
        {isCurrentBase && (
          <p className="-mt-3 text-xs text-gray-400">
            This is the current base currency. Set another currency as base to change it.
          </p>
        )}
      </div>
    </SidePanel>
  );
}
