'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { LevyTaxFormValues, LEVY_TAX_FORM_DEFAULTS } from '@/types/reinsurance';
import { useToast } from '@/hooks/useToast';

export function LevyTaxesForm() {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<LevyTaxFormValues>({
    defaultValues: LEVY_TAX_FORM_DEFAULTS,
  });

  const onSubmit = (data: LevyTaxFormValues) => {
    // TODO: wire to API mutation
    console.log('levy tax data', data);
    toast.success('Levy & tax settings saved');
  };

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Levy & Tax Rates</h2>
        <p className="text-sm text-gray-500 mb-6">
          Set the applicable levy and withholding tax percentages.
        </p>

        <div className="flex flex-col gap-4">
          <FormField
            label="NIC Levy (%)"
            type="number"
            step="0.01"
            registration={register('nicLevy', {
              required: 'NIC levy is required',
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Cannot exceed 100%' },
            })}
            error={errors.nicLevy}
            placeholder="e.g. 2.5"
          />

          <FormField
            label="Withholding Tax (%)"
            type="number"
            step="0.01"
            registration={register('withholdingTax', {
              required: 'Withholding tax is required',
              min: { value: 0, message: 'Must be 0 or greater' },
              max: { value: 100, message: 'Cannot exceed 100%' },
            })}
            error={errors.withholdingTax}
            placeholder="e.g. 5"
          />
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit(onSubmit)} disabled={!isDirty}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
