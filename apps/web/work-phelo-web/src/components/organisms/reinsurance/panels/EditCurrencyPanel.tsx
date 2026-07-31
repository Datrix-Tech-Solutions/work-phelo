'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { Currency, CurrencyFormValues, CURRENCY_FORM_DEFAULTS } from '@/types/reinsurance';
import { useUpdateCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';

interface EditCurrencyPanelProps {
  currency: Currency | null;
  onClose: () => void;
}

function toFormValues(c: Currency): CurrencyFormValues {
  return {
    name: c.name,
    isoCode: c.isoCode,
    symbol: c.symbol ?? '',
    exchangeRateToBase: c.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : '',
    isBaseCurrency: c.isBaseCurrency,
  };
}

export function EditCurrencyPanel({ currency, onClose }: EditCurrencyPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateCurrency, isPending } = useUpdateCurrency();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CurrencyFormValues>({ defaultValues: CURRENCY_FORM_DEFAULTS });

  const isBaseCurrency = useWatch({ control, name: 'isBaseCurrency' });

  useEffect(() => {
    if (currency) reset(toFormValues(currency));
  }, [currency, reset]);

  const handleClose = () => {
    reset(CURRENCY_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CurrencyFormValues) => {
    if (!currency) return;
    try {
      await updateCurrency({
        id: currency.id,
        name: data.name,
        symbol: data.symbol || undefined,
        exchangeRateToBase: data.isBaseCurrency ? undefined : (data.exchangeRateToBase as number),
        isBaseCurrency: data.isBaseCurrency || undefined,
      });
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
      <div className="flex flex-col gap-4">
        <FormField
          label="Currency Name"
          registration={register('name', { required: 'Currency name is required' })}
          error={errors.name}
          placeholder="e.g. Ghana Cedi"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">ISO Code</label>
          <div
            className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}
          >
            {currency?.isoCode}
          </div>
          <p className="text-xs text-gray-400">ISO code cannot be changed after creation.</p>
        </div>

        {/* <FormField
          label="Symbol"
          registration={register('symbol')}
          error={errors.symbol}
          placeholder="e.g. ₵"
        /> */}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-isBaseCurrency"
            {...register('isBaseCurrency')}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="edit-isBaseCurrency" className="text-sm text-gray-700">
            Set as base currency
          </label>
        </div>

        {!isBaseCurrency && (
          <FormField
            label="Exchange Rate to Base Currency"
            type="number"
            registration={register('exchangeRateToBase', {
              required: 'Exchange rate is required',
              min: { value: 0.000001, message: 'Rate must be greater than 0' },
              valueAsNumber: true,
            })}
            error={errors.exchangeRateToBase}
            placeholder="e.g. 16.5"
          />
        )}
      </div>
    </SidePanel>
  );
}
