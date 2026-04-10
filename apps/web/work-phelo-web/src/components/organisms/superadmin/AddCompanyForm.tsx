'use client';

import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/molecules/FormSection';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '../../atoms/SearchSelect';
import { useState } from 'react';

interface AddCompanyPayload {
  name: string;
  email: string;
  slug: string;
  firstName: string;
  lastName: string;
  phone?: string;
  industry?: string;
  size?: string;
}

interface AddCompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1 – 10 employees' },
  { value: '11-50', label: '11 – 50 employees' },
  { value: '51-200', label: '51 – 200 employees' },
  { value: '201-500', label: '201 – 500 employees' },
  { value: '500+', label: '500+ employees' },
];

const INDUSTRY_OPTIONS = [
  { value: 'Agriculture', label: 'Agriculture' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Other', label: 'Other' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function AddCompanyForm({ isOpen, onClose }: AddCompanyFormProps) {
  const queryClient = useQueryClient();

  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [successCompany, setSuccessCompany] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddCompanyPayload>();

  const { mutate, isPending } = useMutation({
    mutationFn: (data: AddCompanyPayload) => api.post('/auth/tenants/register', data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setSuccessCompany(vars.name);
      reset();
    },
  });

  const onSubmit = (data: AddCompanyPayload) => {
    mutate({ ...data, slug: generateSlug(data.name) });
  };

  const handleClose = () => {
    reset();
    setSuccessCompany(null);
    onClose();
  };

  return (
    <>
      <SuccessModal
        isOpen={!!successCompany}
        onClose={handleClose}
        title="Company Created!"
        message={`${successCompany} has been onboarded successfully. An invite will be sent to the administrator.`}
        actionLabel="Done"
      />

      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Add New Company"
        description="Add a new company to onboard them onto WorkPhelo."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={isPending}
              loadingText="Saving..."
              onClick={handleSubmit(onSubmit)}
            >
              Save
            </Button>
          </div>
        }
      >
        {/* Company Information */}
        <FormSection title="Company Information">
          <FormField
            label="Company Name"
            registration={register('name', { required: 'Company name is required' })}
            error={errors.name}
            placeholder="eg; Acme Corp Ltd"
          />

          <SearchSelect
            label="Company Size"
            placeholder="Select size range"
            options={COMPANY_SIZE_OPTIONS}
            value={size}
            onChange={(v) => {
              setSize(v);
              setValue('size', v);
            }}
            error={errors.size?.message}
          />
          <SearchSelect
            label="Select Industry"
            placeholder="Industry"
            options={INDUSTRY_OPTIONS}
            value={industry}
            onChange={(v) => {
              setIndustry(v);
              setValue('industry', v);
            }}
          />
        </FormSection>

        {/* Administrator Information */}
        <FormSection title="Administrator Information">
          <FormField
            label="First Name"
            registration={register('firstName', { required: 'First name is required' })}
            error={errors.firstName}
            placeholder="eg; Daniel"
          />
          <FormField
            label="Last Name"
            registration={register('lastName', { required: 'Last name is required' })}
            error={errors.lastName}
            placeholder="eg; Asante"
          />
          <PhoneInput
            label="Contact"
            placeholder="00 000 0000"
            onChange={(v) => setValue('phone', v)}
          />
          <FormField
            label="Email Address"
            registration={register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
            })}
            error={errors.email}
            type="email"
            placeholder="eg; daniel@datrix.com"
          />
        </FormSection>
      </SidePanel>
    </>
  );
}
