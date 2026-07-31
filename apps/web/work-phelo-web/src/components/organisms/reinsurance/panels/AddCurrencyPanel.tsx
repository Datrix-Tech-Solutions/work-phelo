'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { CurrencyFormValues, CURRENCY_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCurrencyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCurrencyPanel({ isOpen, onClose }: AddCurrencyPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCurrency, isPending } = useCreateCurrency();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CurrencyFormValues>({
    defaultValues: CURRENCY_FORM_DEFAULTS,
  });

  const isBaseCurrency = useWatch({ control, name: 'isBaseCurrency' });

  const handleClose = () => {
    reset(CURRENCY_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CurrencyFormValues) => {
    try {
      await createCurrency({
        name: data.name,
        isoCode: data.isoCode,
        symbol: data.symbol || undefined,
        exchangeRateToBase: data.isBaseCurrency ? undefined : (data.exchangeRateToBase as number),
        isBaseCurrency: data.isBaseCurrency || undefined,
      });
      toast.success('Currency created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create currency'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Currency"
      description="Add a new currency and set its exchange rate."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Currency
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

        <FormField
          label="ISO Code"
          registration={register('isoCode', {
            required: 'ISO code is required',
            maxLength: { value: 3, message: 'ISO code must be 3 characters' },
            minLength: { value: 3, message: 'ISO code must be 3 characters' },
            setValueAs: (v: string) => v.toUpperCase(),
          })}
          error={errors.isoCode}
          placeholder="e.g. GHS"
        />

        {/* <FormField
          label="Symbol"
          registration={register('symbol')}
          error={errors.symbol}
          placeholder="e.g. ₵"
        /> */}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isBaseCurrency"
            {...register('isBaseCurrency')}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="isBaseCurrency" className="text-sm text-gray-700">
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
