'use client';

import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';

const PROBATION_OPTIONS = [
  { value: '3', label: '3 months' },
  { value: '4', label: '4 months' },
  { value: '5', label: '5 months' },
  { value: '6', label: '6 months' },
  { value: 'undefined', label: 'Undefined (7+ months)' },
];

const RESIGNATION_OPTIONS = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '1m', label: '1 month' },
  { value: '2m', label: '2 months' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: '2y', label: '2 years' },
];

interface EmploymentForm {
  probationPeriod: string;
  resignationWindow: string;
}

export default function EmploymentPoliciesPage() {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<EmploymentForm>({
    defaultValues: {
      probationPeriod: '',
      resignationWindow: '',
    },
  });

  const onSubmit = () => {
    // TODO: wire up to POST /hr/settings/company-policies when endpoint is ready
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-xl">
      <FormSection title="Employment">
        <Controller
          name="probationPeriod"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Default Probation Period"
              placeholder="Select probation period"
              options={PROBATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection title="Resignation">
        <Controller
          name="resignationWindow"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Resignation Notice Period"
              placeholder="Select notice period"
              options={RESIGNATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <div>
        <Button type="submit" disabled={!isDirty}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
