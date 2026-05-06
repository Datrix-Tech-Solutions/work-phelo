'use client';

import { useForm } from 'react-hook-form';
import { useRegisterTenant } from '@/hooks/useTenants';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '../../atoms/SearchSelect';
import { useState } from 'react';
import { COMPANY_SIZE_OPTIONS, INDUSTRY_OPTIONS } from '@/lib/CompanyOptions';

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function AddCompanyInner({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddCompanyPayload>();

  const { mutate: registerTenant, isPending } = useRegisterTenant();

  const onSubmit = (data: AddCompanyPayload) => {
    registerTenant(
      { ...data, slug: generateSlug(data.name) },
      {
        onSuccess: (_, vars) => {
          onSuccess(vars.name);
          onClose();
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Add New Company"
      description="Add a new company to onboard them onto WorkPhelo."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
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
          placeholder="eg; Companyname Corp Ltd"
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
          placeholder="eg; name@companydomain.com"
        />
      </FormSection>
    </SidePanel>
  );
}

export function AddCompanyForm({ isOpen, onClose }: AddCompanyFormProps) {
  const [successCompany, setSuccessCompany] = useState<string | null>(null);

  return (
    <>
      <SuccessModal
        isOpen={!!successCompany}
        onClose={() => setSuccessCompany(null)}
        title="Company Created!"
        message={`${successCompany} has been onboarded successfully. An invite will be sent to the administrator.`}
        actionLabel="Done"
      />
      {isOpen ? (
        <AddCompanyInner onClose={onClose} onSuccess={(name) => setSuccessCompany(name)} />
      ) : (
        <SidePanel isOpen={false} onClose={onClose} title="">
          {null}
        </SidePanel>
      )}
    </>
  );
}
