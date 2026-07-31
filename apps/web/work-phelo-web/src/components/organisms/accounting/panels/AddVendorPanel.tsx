'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';

interface AddVendorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  contactName: string;
  contactNumber: string;
  email: string;
};

const DEFAULTS: FormValues = {
  vendorCode: '',
  vendorName: '',
  vendorCategory: '',
  contactName: '',
  contactNumber: '',
  email: '',
};

const CATEGORY_OPTIONS: SearchSelectOption[] = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'service-provider', label: 'Service Provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'other', label: 'Other' },
];

export function AddVendorPanel({ isOpen, onClose }: AddVendorPanelProps) {
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
    // Not wired to useCreateVendor yet: the backend requires `currency` (not on this
    // form) and has no "category"/multi-contact fields to send vendorCategory/contacts to.
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Vendor"
      description="Register a new vendor to your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Add Vendor</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Vendor Code"
          type="number"
          registration={register('vendorCode', { required: 'Vendor code is required' })}
          error={errors.vendorCode}
          placeholder="e.g. 2001"
        />

        <FormField
          label="Vendor Name"
          registration={register('vendorName', { required: 'Vendor name is required' })}
          error={errors.vendorName}
          placeholder="e.g. Acme Supplies Ltd."
        />

        <Controller
          name="vendorCategory"
          control={control}
          rules={{ required: 'Vendor category is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Vendor Category"
              placeholder="Select category…"
              options={CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.vendorCategory?.message}
            />
          )}
        />

        <FormSection title="Contact Person">
          <FormField
            label="Primary Contact Name"
            registration={register('contactName')}
            error={errors.contactName}
            placeholder="e.g. John Mensah"
          />

          <Controller
            name="contactNumber"
            control={control}
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Contact Number"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <FormField
            label="Email"
            type="email"
            registration={register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            error={errors.email}
            placeholder="e.g. john@acmesupplies.com"
          />
        </FormSection>
      </div>
    </SidePanel>
  );
}
