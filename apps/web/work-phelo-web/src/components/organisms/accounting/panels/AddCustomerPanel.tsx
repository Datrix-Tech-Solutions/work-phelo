'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';

interface AddCustomerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  customerCode: string;
  customerName: string;
  customerCategory: string;
  contactName: string;
  contactNumber: string;
  email: string;
};

const DEFAULTS: FormValues = {
  customerCode: '',
  customerName: '',
  customerCategory: '',
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

export function AddCustomerPanel({ isOpen, onClose }: AddCustomerPanelProps) {
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
    // Not wired to useCreateCustomer yet: the backend requires `currency` (not on this
    // form) and has no "category"/multi-contact fields to send customerCategory/contacts to.
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Customer"
      description="Register a new customer to your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Add Customer</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Customer Code"
          type="number"
          registration={register('customerCode', { required: 'Customer code is required' })}
          error={errors.customerCode}
          placeholder="e.g. 2001"
        />

        <FormField
          label="Customer Name"
          registration={register('customerName', { required: 'Customer name is required' })}
          error={errors.customerName}
          placeholder="e.g. Acme Supplies Ltd."
        />

        <Controller
          name="customerCategory"
          control={control}
          rules={{ required: 'Customer category is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Customer Category"
              placeholder="Select category…"
              options={CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.customerCategory?.message}
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
