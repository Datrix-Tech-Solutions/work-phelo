'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { cardClass } from '@/lib/utils';
import {
  useActivateReinsuranceCharge,
  useCreateReinsuranceCharge,
  useDeactivateReinsuranceCharge,
  useReinsuranceCharges,
  useUpdateReinsuranceCharge,
} from '@/hooks/reinsurance/useReinsuranceCharges';
import { useToast } from '@/hooks/useToast';
import {
  LEVY_TAX_FORM_DEFAULTS,
  LevyTaxFormValues,
  ReinsuranceChargeCode,
  ReinsuranceChargeConfiguration,
  ReinsuranceChargePayload,
  ReinsuranceChargeType,
} from '@/types/reinsurance';

const codeLabels: Record<string, string> = {
  NIC_LEVY: 'NIC Levy',
  WITHHOLDING_TAX: 'Withholding Tax',
};

const chargeTypeByCode: Record<ReinsuranceChargeCode, ReinsuranceChargeType> = {
  NIC_LEVY: 'LEVY',
  WITHHOLDING_TAX: 'TAX',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'NIC_LEVY', label: 'NIC Levy' },
  { value: 'WITHHOLDING_TAX', label: 'Withholding Tax' },
];

function errorMessage(error: unknown, fallback: string): string {
  const response = error as { response?: { data?: { message?: string } } };
  return response.response?.data?.message ?? fallback;
}

function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toPayload(values: LevyTaxFormValues): ReinsuranceChargePayload {
  return {
    code: values.code,
    name: values.name,
    chargeType: values.chargeType,
    rateType: values.rateType,
    rate: Number(values.rate),
    calculationBasis: values.calculationBasis,
    direction: values.direction,
    currency: values.currency.trim() || null,
    effectiveFrom: toIsoDate(values.effectiveFrom),
    effectiveTo: values.effectiveTo ? toIsoDate(values.effectiveTo) : null,
    roundingMode: values.roundingMode,
    decimalPlaces: values.decimalPlaces,
    isEnabled: values.isEnabled,
    displayOrder: values.displayOrder,
  };
}

function toUpdatePayload(values: LevyTaxFormValues): Omit<ReinsuranceChargePayload, 'code'> {
  const payloadWithCode = toPayload(values);
  const { code, ...payload } = payloadWithCode;
  void code;
  return payload;
}

function fromConfiguration(config: ReinsuranceChargeConfiguration): LevyTaxFormValues {
  return {
    id: config.id,
    code: config.code,
    name: config.name,
    chargeType: config.chargeType,
    rateType: config.rateType,
    rate: Number(config.rate),
    calculationBasis: config.calculationBasis,
    direction: config.direction,
    currency: config.currency ?? '',
    effectiveFrom: toDateInput(config.effectiveFrom),
    effectiveTo: toDateInput(config.effectiveTo),
    roundingMode: config.roundingMode,
    decimalPlaces: config.decimalPlaces,
    isEnabled: config.isEnabled,
    displayOrder: config.displayOrder,
  };
}

export function LevyTaxesForm() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const charges = useReinsuranceCharges();
  const createCharge = useCreateReinsuranceCharge();
  const updateCharge = useUpdateReinsuranceCharge();
  const activateCharge = useActivateReinsuranceCharge();
  const deactivateCharge = useDeactivateReinsuranceCharge();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<LevyTaxFormValues>({
    defaultValues: LEVY_TAX_FORM_DEFAULTS,
  });

  const selectedCharge = charges.data?.find((charge) => charge.id === selectedId);
  useEffect(() => {
    if (selectedCharge) reset(fromConfiguration(selectedCharge));
  }, [reset, selectedCharge]);

  const onSubmit = async (values: LevyTaxFormValues) => {
    try {
      const payload = toPayload(values);
      if (values.id) {
        await updateCharge.mutateAsync({ id: values.id, ...toUpdatePayload(values) });
        toast.success('Tax and levy configuration updated');
      } else {
        const created = await createCharge.mutateAsync(payload);
        setSelectedId(created.id);
        toast.success('Tax and levy configuration created');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save tax and levy configuration'));
    }
  };

  const handleToggle = async (charge: ReinsuranceChargeConfiguration) => {
    try {
      if (charge.isEnabled) {
        await deactivateCharge.mutateAsync(charge.id);
        toast.success('Configuration deactivated');
      } else {
        await activateCharge.mutateAsync(charge.id);
        toast.success('Configuration activated');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update configuration status'));
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className={cardClass('overflow-hidden h-fit')}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Configured Charges</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              reset(LEVY_TAX_FORM_DEFAULTS);
            }}
          >
            New Configuration
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {charges.isLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading configurations...</p>
          ) : charges.data?.length ? (
            charges.data.map((charge) => (
              <div
                key={charge.id}
                className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedId(charge.id)}
                >
                  <p className="font-medium text-gray-900">
                    {codeLabels[charge.code] ?? charge.name}
                    <span className="ml-2 text-xs font-normal text-gray-500">{charge.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {charge.rateType === 'PERCENTAGE' ? `${charge.rate}%` : charge.rate}
                    {' · '}
                    {charge.direction.toLowerCase()}
                    {' · '}
                    {charge.currency ?? 'All currencies'}
                    {' · '}
                    from {toDateInput(charge.effectiveFrom)}
                    {charge.effectiveTo ? ` to ${toDateInput(charge.effectiveTo)}` : ''}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      charge.isEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {charge.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isLoading={activateCharge.isPending || deactivateCharge.isPending}
                    onClick={() => handleToggle(charge)}
                  >
                    {charge.isEnabled ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-gray-500">
              No charge configurations yet. Create one to get started.
            </p>
          )}
        </div>
      </div>

      <div className={cardClass('p-6 h-fit')}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {selectedId ? 'Edit Configuration' : 'New Configuration'}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Configure the tenant-approved rate. No statutory rate is assumed by WorkPhelo.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {selectedId ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-900">Type</label>
              <div className="rounded-input border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                {selectedCharge
                  ? (codeLabels[selectedCharge.code] ?? selectedCharge.code)
                  : 'Locked'}
              </div>
              <p className="text-xs text-gray-500">
                Charge type is locked after creation. Create a new configuration for another type.
              </p>
            </div>
          ) : (
            <Controller
              name="code"
              control={control}
              rules={{ required: 'Type is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Type"
                  placeholder="Select type…"
                  options={TYPE_OPTIONS}
                  value={field.value}
                  onChange={(value) => {
                    const code = value as ReinsuranceChargeCode;
                    field.onChange(code);
                    setValue('chargeType', chargeTypeByCode[code], { shouldDirty: true });
                  }}
                  error={errors.code?.message}
                />
              )}
            />
          )}

          <FormField
            label="Name"
            registration={register('name', { required: 'Name is required' })}
            error={errors.name}
          />

          <FormField
            label="Rate (%)"
            type="number"
            step="0.000001"
            registration={register('rate', {
              required: 'Rate is required',
              valueAsNumber: true,
              min: { value: 0, message: 'Rate must be 0 or greater' },
            })}
            error={errors.rate}
            placeholder="Enter tenant-approved rate"
          />

          <Controller
            name="effectiveFrom"
            control={control}
            rules={{ required: 'Effective from date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Effective From"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveFrom?.message}
              />
            )}
          />

          <Button
            type="submit"
            className="mt-2"
            disabled={!isDirty}
            isLoading={createCharge.isPending || updateCharge.isPending}
          >
            {selectedId ? 'Update Configuration' : 'Create Configuration'}
          </Button>
        </form>
      </div>
    </div>
  );
}
