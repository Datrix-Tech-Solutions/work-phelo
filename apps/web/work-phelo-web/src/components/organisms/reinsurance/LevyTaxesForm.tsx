'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useActivateReinsuranceCharge,
  useCreateReinsuranceCharge,
  useDeactivateReinsuranceCharge,
  usePreviewReinsuranceCharges,
  useReinsuranceCharges,
  useReinsuranceChargeTemplates,
  useUpdateReinsuranceCharge,
} from '@/hooks/reinsurance/useReinsuranceCharges';
import { useToast } from '@/hooks/useToast';
import {
  LEVY_TAX_FORM_DEFAULTS,
  LevyTaxFormValues,
  ReinsuranceChargeConfiguration,
  ReinsuranceChargePayload,
} from '@/types/reinsurance';

const codeLabels: Record<string, string> = {
  NIC_LEVY: 'NIC Levy',
  WITHHOLDING_TAX: 'Withholding Tax',
};

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
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null);
  const [previewCurrency, setPreviewCurrency] = useState('GHS');
  const [previewGross, setPreviewGross] = useState('10000');
  const [previewCommission, setPreviewCommission] = useState('1000');
  const [previewBrokerage, setPreviewBrokerage] = useState('0');

  const charges = useReinsuranceCharges();
  const templates = useReinsuranceChargeTemplates();
  const createCharge = useCreateReinsuranceCharge();
  const updateCharge = useUpdateReinsuranceCharge();
  const activateCharge = useActivateReinsuranceCharge();
  const deactivateCharge = useDeactivateReinsuranceCharge();
  const previewCharges = usePreviewReinsuranceCharges();

  const {
    register,
    handleSubmit,
    reset,
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
        await updateCharge.mutateAsync({ id: values.id, ...payload });
        toast.success('Tax and levy configuration updated');
      } else {
        const created = await createCharge.mutateAsync(payload);
        setSelectedId(created.id);
        setSelectedTemplateCode(created.code);
        toast.success('Tax and levy configuration created');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save tax and levy configuration'));
    }
  };

  const applyTemplate = (templateCode: string) => {
    const template = templates.data?.find((item) => item.code === templateCode);
    if (!template) return;
    setSelectedId(null);
    setSelectedTemplateCode(template.code);
    reset({
      ...LEVY_TAX_FORM_DEFAULTS,
      code: template.code,
      name: template.name,
      chargeType: template.chargeType,
      rateType: template.rateType,
      calculationBasis: template.calculationBasis,
      direction: template.direction,
      rate: '',
    });
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

  const runPreview = async () => {
    try {
      await previewCharges.mutateAsync({
        currency: previewCurrency,
        grossAmount: Number(previewGross),
        commissionAmount: Number(previewCommission || 0),
        brokerageAmount: Number(previewBrokerage || 0),
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not calculate preview'));
    }
  };
  const activeTemplateCode = selectedCharge?.code ?? selectedTemplateCode;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Taxes and Levies</h2>
              <p className="text-sm text-gray-500">
                Configure tenant-approved Reinsurance charges. No statutory rate is assumed by
                WorkPhelo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedId(null);
                setSelectedTemplateCode(null);
                reset(LEVY_TAX_FORM_DEFAULTS);
              }}
            >
              New Configuration
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {templates.data?.map((template) => (
              <Button
                key={template.code}
                type="button"
                size="sm"
                variant={activeTemplateCode === template.code ? 'secondary' : 'outline'}
                onClick={() => applyTemplate(template.code)}
              >
                Use {template.name} Template
              </Button>
            ))}
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Charge Code
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('code', { required: 'Charge code is required' })}
              >
                <option value="NIC_LEVY">NIC Levy</option>
                <option value="WITHHOLDING_TAX">Withholding Tax</option>
              </select>
              {errors.code && <span className="text-xs text-red-500">{errors.code.message}</span>}
            </label>

            <FormField
              label="Name"
              registration={register('name', { required: 'Name is required' })}
              error={errors.name}
            />

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Charge Type
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('chargeType', { required: 'Charge type is required' })}
              >
                <option value="LEVY">Levy</option>
                <option value="TAX">Tax</option>
                <option value="FEE">Fee</option>
                <option value="DUTY">Duty</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Rate Type
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('rateType', { required: 'Rate type is required' })}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
              </select>
            </label>

            <FormField
              label="Rate"
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

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Calculation Basis
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('calculationBasis', {
                  required: 'Calculation basis is required',
                })}
              >
                <option value="NET_BEFORE_CHARGES">Net Before Charges</option>
                <option value="GROSS_AMOUNT">Gross Amount</option>
                <option value="COMMISSION_AMOUNT">Commission Amount</option>
                <option value="BROKERAGE_AMOUNT">Brokerage Amount</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Direction
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('direction', { required: 'Direction is required' })}
              >
                <option value="DEDUCTION">Deduction</option>
                <option value="ADDITION">Addition</option>
              </select>
            </label>

            <FormField
              label="Currency (optional)"
              registration={register('currency', {
                setValueAs: (value) => String(value ?? '').toUpperCase(),
                maxLength: { value: 3, message: 'Use a 3-letter ISO code' },
              })}
              error={errors.currency}
              placeholder="Blank = all currencies"
            />

            <FormField
              label="Effective From"
              type="date"
              registration={register('effectiveFrom', {
                required: 'Effective from date is required',
              })}
              error={errors.effectiveFrom}
            />

            <FormField
              label="Effective To (optional)"
              type="date"
              registration={register('effectiveTo')}
              error={errors.effectiveTo}
            />

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Rounding
              <select
                className="rounded-input border border-gray-300 px-3 py-2 text-sm"
                {...register('roundingMode')}
              >
                <option value="HALF_UP">Half Up</option>
                <option value="UP">Up</option>
                <option value="DOWN">Down</option>
              </select>
            </label>

            <FormField
              label="Decimal Places"
              type="number"
              registration={register('decimalPlaces', {
                valueAsNumber: true,
                min: { value: 0, message: 'Minimum is 0' },
                max: { value: 6, message: 'Maximum is 6' },
              })}
              error={errors.decimalPlaces}
            />

            <FormField
              label="Display Order"
              type="number"
              registration={register('displayOrder', {
                valueAsNumber: true,
                min: { value: 0, message: 'Minimum is 0' },
              })}
              error={errors.displayOrder}
            />

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 md:pt-7">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                {...register('isEnabled')}
              />
              Enabled
            </label>

            <div className="md:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={!isDirty}
                isLoading={createCharge.isPending || updateCharge.isPending}
              >
                {selectedId ? 'Update Configuration' : 'Create Configuration'}
              </Button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Configured Charges</h3>
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
                        charge.isEnabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-600'
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
                No charge configurations yet. Use a template to start, then enter the
                tenant-approved rate.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Preview Calculation</h3>
        <p className="text-sm text-gray-500 mb-4">
          Test enabled configurations without saving a note or document.
        </p>
        <div className="space-y-3">
          <input
            className="w-full rounded-input border border-gray-300 px-3 py-2 text-sm"
            value={previewCurrency}
            onChange={(event) => setPreviewCurrency(event.target.value.toUpperCase())}
            placeholder="Currency"
          />
          <input
            className="w-full rounded-input border border-gray-300 px-3 py-2 text-sm"
            value={previewGross}
            onChange={(event) => setPreviewGross(event.target.value)}
            type="number"
            placeholder="Gross amount"
          />
          <input
            className="w-full rounded-input border border-gray-300 px-3 py-2 text-sm"
            value={previewCommission}
            onChange={(event) => setPreviewCommission(event.target.value)}
            type="number"
            placeholder="Commission amount"
          />
          <input
            className="w-full rounded-input border border-gray-300 px-3 py-2 text-sm"
            value={previewBrokerage}
            onChange={(event) => setPreviewBrokerage(event.target.value)}
            type="number"
            placeholder="Brokerage amount"
          />
          <Button
            type="button"
            className="w-full"
            onClick={runPreview}
            isLoading={previewCharges.isPending}
          >
            Preview
          </Button>
        </div>

        {previewCharges.data && (
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Net before charges</span>
              <span className="font-medium">{previewCharges.data.netBeforeCharges.toFixed(2)}</span>
            </div>
            {previewCharges.data.charges.map((charge) => (
              <div key={charge.configurationId} className="flex justify-between">
                <span className="text-gray-500">{charge.name}</span>
                <span className="font-medium">
                  {charge.direction === 'DEDUCTION' ? '-' : '+'}
                  {charge.amount.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Net after charges</span>
              <span className="font-semibold text-gray-900">
                {previewCharges.data.netAmount.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
