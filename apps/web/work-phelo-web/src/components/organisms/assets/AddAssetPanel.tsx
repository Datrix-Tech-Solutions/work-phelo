'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { useTenantConfig } from '@/hooks/useTenantConfig';

interface AssetForm {
  name: string;
  type: string;
  customType?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency: string;
  condition?: string;
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AssetForm) => void;
}

export function AddAssetPanel({ isOpen, onClose, onSubmit }: Props) {
  const { currency: tenantCurrency } = useTenantConfig();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AssetForm>({ defaultValues: { currency: tenantCurrency } });

  const typeValue = useWatch({ control, name: 'type' });
  const conditionValue = useWatch({ control, name: 'condition' });
  const purchaseDateValue = useWatch({ control, name: 'purchaseDate' });
  const purchaseCostValue = useWatch({ control, name: 'purchaseCost' });
  const currencyValue = useWatch({ control, name: 'currency' });

  const handleClose = () => {
    reset({ currency: tenantCurrency });
    onClose();
  };

  const handleFormSubmit = (data: AssetForm) => {
    const payload = { ...data };
    if (payload.type === 'OTHER' && payload.customType) {
      payload.type = payload.customType;
    }
    delete payload.customType;
    onSubmit(payload);
    reset({ currency: tenantCurrency });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Asset"
      description="Register a new asset in the system."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)}>Add Asset</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Asset Details
        </p>

        <FormField
          label="Asset Name"
          registration={register('name', { required: 'Required' })}
          error={errors.name}
          placeholder="eg; MacBook Pro 14-inch"
        />

        <SearchSelect
          label="Asset Type"
          placeholder="Select type"
          value={typeValue}
          onChange={(v) => {
            setValue('type', v);
            if (v !== 'OTHER') setValue('customType', undefined);
          }}
          options={[
            { value: 'LAPTOP', label: 'Laptop' },
            { value: 'PHONE', label: 'Phone' },
            { value: 'TABLET', label: 'Tablet' },
            { value: 'PRINTER', label: 'Printer' },
            { value: 'MONITOR', label: 'Monitor' },
            { value: 'VEHICLE', label: 'Vehicle' },
            { value: 'FURNITURE', label: 'Furniture' },
            { value: 'SOFTWARE_LICENSE', label: 'Software License' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />
        {typeValue === 'OTHER' && (
          <FormField
            label="Specify asset type"
            registration={register('customType', { required: 'Please specify the asset type' })}
            error={errors.customType}
            placeholder="eg; Projector"
          />
        )}

        <FormField
          label="Serial Number"
          registration={register('serialNumber')}
          placeholder="eg; C02XL0LFJGH5"
        />

        <DatePicker
          label="Purchase Date"
          value={purchaseDateValue}
          onChange={(v) => setValue('purchaseDate', v)}
          disableFuture
        />

        <CurrencyInput
          label="Purchase Cost"
          value={purchaseCostValue}
          currency={currencyValue}
          onValueChange={(v) => setValue('purchaseCost', v)}
          onCurrencyChange={(v) => setValue('currency', v)}
          placeholder="0.00"
        />

        <SearchSelect
          label="Condition"
          placeholder="Select condition"
          value={conditionValue}
          onChange={(v) => setValue('condition', v)}
          options={[
            { value: 'NEW', label: 'New' },
            { value: 'GOOD', label: 'Good' },
            { value: 'FAIR', label: 'Fair' },
            { value: 'POOR', label: 'Poor' },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Any additional notes about this asset…"
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none"
          />
        </div>
      </div>
    </SidePanel>
  );
}
