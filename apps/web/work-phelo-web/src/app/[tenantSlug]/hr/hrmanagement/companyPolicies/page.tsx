'use client';

import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn } from '@/lib/utils';

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

const CYCLE_RECIPIENTS_OPTIONS = [
  { value: 'all', label: 'All Employees' },
  { value: 'permanent', label: 'Permanent Employees' },
  { value: 'contractual', label: 'Contractual Employees' },
  { value: 'probation', label: 'Probationary Employees' },
  { value: 'interns', label: 'Interns' },
];

interface CompanyPoliciesForm {
  probationPeriod: string;
  resignationWindow: string;
  cycleRecipients: string[];
}

export default function CompanyPoliciesPage() {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<CompanyPoliciesForm>({
    defaultValues: {
      probationPeriod: '',
      resignationWindow: '',
      cycleRecipients: [],
    },
  });

  const onSubmit = () => {
    // TODO: wire up to POST /hr/settings/company-policies when endpoint is ready
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-xl">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default HR policies for your organisation
        </p>
      </div>

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

      <FormSection title="Default Cycle Recipients">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Default Cycle Recipients</label>
          <p className="text-xs text-gray-500">
            Select which employee groups are included in appraisal cycles by default
          </p>
          <Controller
            name="cycleRecipients"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-0 border border-gray-200 rounded-lg overflow-hidden mt-1">
                {CYCLE_RECIPIENTS_OPTIONS.map((opt, i) => {
                  const checked = field.value.includes(opt.value);
                  const toggle = () => {
                    const next = checked
                      ? field.value.filter((v) => v !== opt.value)
                      : [...field.value, opt.value];
                    field.onChange(next);
                  };
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                        i > 0 && 'border-t border-gray-100',
                        checked ? 'bg-orange-50' : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={toggle}
                        className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>
      </FormSection>

      <div>
        <Button type="submit" disabled={!isDirty}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
