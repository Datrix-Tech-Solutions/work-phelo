'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { FormSection } from '@/components/molecules/FormSection';
import { Select } from '@/components/atoms/Select';
import { PhoneInput } from '@/components/atoms/PhoneInput';

interface AddCompanyPayload {
  companyName: string;
  companySize: string;
  industry: string;
  location: string;
  contactNumber: string;
  adminName: string;
  adminContact: string;
  adminEmail: string;
  status?: 'ACTIVE' | 'DRAFT';
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

export function AddCompanyForm({ isOpen, onClose }: AddCompanyFormProps) {
  const queryClient = useQueryClient();
  const isDraftRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddCompanyPayload>();

  const { mutate, isPending } = useMutation({
    mutationFn: (data: AddCompanyPayload) => api.post('/auth/tenants/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      onClose();
    },
  });

  const onSubmit = (data: AddCompanyPayload) => {
    mutate({ ...data, status: isDraftRef.current ? 'DRAFT' : 'ACTIVE' });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
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
            variant="secondary"
            type="button"
            isLoading={isPending && isDraftRef.current}
            loadingText="Saving..."
            onClick={() => {
              isDraftRef.current = true;
              handleSubmit(onSubmit)();
            }}
          >
            Save to Draft
          </Button>
          <Button
            type="button"
            isLoading={isPending && !isDraftRef.current}
            loadingText="Saving..."
            onClick={() => {
              isDraftRef.current = false;
              handleSubmit(onSubmit)();
            }}
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
          registration={register('companyName', { required: 'Company name is required' })}
          error={errors.companyName}
          placeholder="eg; Acme Corp Ltd"
        />
        <Select
          label="Company Size"
          placeholder="Select range"
          options={COMPANY_SIZE_OPTIONS}
          {...register('companySize', { required: 'Company size is required' })}
          error={errors.companySize?.message}
        />
        <Select
          label="Industry"
          placeholder="Select industry"
          options={INDUSTRY_OPTIONS}
          {...register('industry', { required: 'Industry is required' })}
          error={errors.industry?.message}
        />
        <FormField
          label="Location"
          registration={register('location', { required: 'Location is required' })}
          error={errors.location}
          placeholder="eg; Accra, Ghana"
        />
        <PhoneInput
          label="Contact"
          placeholder="00 000 0000"
          onChange={(v) => setValue('contactNumber', v)}
        />
      </FormSection>

      {/* Administrator Information */}
      <FormSection title="Administrator Information">
        <FormField
          label="Name"
          registration={register('adminName', { required: 'Admin name is required' })}
          error={errors.adminName}
          placeholder="eg; Daniel Asante"
        />
        <FormField
          label="Contact Number"
          registration={register('adminContact', { required: 'Contact number is required' })}
          error={errors.adminContact}
          placeholder="eg; 0242347474"
        />
        <FormField
          label="Email Address"
          registration={register('adminEmail', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={errors.adminEmail}
          type="email"
          placeholder="eg; paul@datrix.com"
        />
      </FormSection>
    </SidePanel>
  );
}
