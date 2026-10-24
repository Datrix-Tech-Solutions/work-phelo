'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, FilePlus2, LayoutTemplate } from 'lucide-react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Toggle } from '@/components/atoms/Toggle';
import { useClients } from '@/hooks/marketing/useClients';
import { inputClass } from '@/lib/utils';
import {
  CreateProjectDto,
  ProjectBillingType,
  ProjectConfig,
  ProjectPricing,
  ProjectTemplate,
  ProjectType,
} from '@/types/hr';
import { BILLING_TYPE_OPTIONS, PROJECT_TYPE_OPTIONS } from '@/lib/projectTypes';
import { ProjectPricingFields } from '@/components/molecules/hr/projects/ProjectPricingFields';
import {
  EMPTY_PRICING_DRAFT,
  PricingDraft,
  buildPricing,
  pricingError,
} from '@/lib/projectPricing';
import { BLANK_PROJECT_CONFIG } from '@/lib/defaultProjectTemplates';
import { pickConfig } from '@/lib/projectConfig';
import {
  ProjectConfigFields,
  getProjectConfigErrors,
} from '@/components/molecules/hr/projects/ProjectConfigFields';
import { EmployeeOption } from '@/types/hr';
import { useProjectLabels } from '@/hooks/useModuleLabels';

interface CreateProjectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  /** `projectType` and `config` aren't part of the API payload yet, so they come alongside it. */
  onSubmit: (
    data: CreateProjectDto,
    projectType: ProjectType,
    config: ProjectConfig,
    /** Only for a client project. */
    clientInfo?: {
      billable: boolean;
      pricing?: ProjectPricing;
      client?: { id: string; name: string };
    },
  ) => void;
  isSubmitting?: boolean;
  /** Template the project is being created from; null is a blank slate. A blank slate shows the setup fields
   *  to fill in for this project only; a template brings its own. Remount (key) to reapply a different one. */
  template?: ProjectTemplate | null;
}

type FormValues = {
  name: string;
  projectType: ProjectType | '';
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  managerId: string;
  billable: boolean;
  billingType: ProjectBillingType | '';
  pricing: PricingDraft;
  clientId: string;
  config: ProjectConfig;
};

export function CreateProjectPanel({
  isOpen,
  onClose,
  employees,
  onSubmit,
  isSubmitting,
  template,
}: CreateProjectPanelProps) {
  const labels = useProjectLabels();
  const [setupOpen, setSetupOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitted },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      budget: '',
      managerId: '',
      projectType: '',
      billable: false,
      billingType: '',
      pricing: EMPTY_PRICING_DRAFT,
      clientId: '',
      config: template ? pickConfig(template) : BLANK_PROJECT_CONFIG,
    },
  });

  const projectType = useWatch({ control, name: 'projectType' });
  const isClientProject = projectType === 'CLIENT';
  const billable = useWatch({ control, name: 'billable' });
  const billingType = useWatch({ control, name: 'billingType' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });
  // Just a pick-list of the marketing clients, so it isn't held back by the person's marketing access.
  const { data: clientList } = useClients({ limit: 100 }, isClientProject);
  const clients = clientList?.data ?? [];
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.companyName }));

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const onValid = (values: FormValues) => {
    onSubmit(
      {
        name: values.name,
        description: values.description || undefined,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        budget: values.budget ? Number(values.budget) : undefined,
        managerId: values.managerId || undefined,
      },
      values.projectType as ProjectType,
      values.config,
      values.projectType === 'CLIENT'
        ? {
            billable: values.billable,
            pricing:
              values.billable && values.billingType
                ? buildPricing(values.billingType, values.pricing)
                : undefined,
            client: clients
              .filter((c) => c.id === values.clientId)
              .map((c) => ({ id: c.id, name: c.companyName }))[0],
          }
        : undefined,
    );
  };

  const managerOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
    sublabel: e.jobTitle,
  }));

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`New ${labels.singular}`}
      description={`Create a new ${labels.singularLower} and assign an owner.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} loadingText="Creating…" onClick={handleSubmit(onValid)}>
            Create {labels.singular}
          </Button>
        </div>
      }
    >
      {/* Tighter than the panel's default gap-6 between fields. */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0">
              {template ? (
                <LayoutTemplate className="w-5 h-5 text-brand" />
              ) : (
                <FilePlus2 className="w-5 h-5 text-brand" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Template</p>
              <p className="text-base font-bold text-gray-900 truncate">
                {template ? template.name : 'Blank'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label={`${labels.singular} Name`}
            registration={register('name', { required: `${labels.singular} name is required` })}
            error={errors.name}
            placeholder="e.g. Website Redesign"
          />
          <Controller
            name="projectType"
            control={control}
            rules={{ required: `${labels.singular} type is required` }}
            render={({ field }) => (
              <SearchSelect
                label={`${labels.singular} Type`}
                placeholder={`Select ${labels.singularLower} type`}
                options={PROJECT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.projectType?.message}
              />
            )}
          />
        </div>

        {isClientProject && (
          <div
            className={
              billable
                ? 'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-start'
                : 'grid grid-cols-1 sm:grid-cols-2 gap-4 items-start'
            }
          >
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Client"
                  placeholder="Select client (optional)"
                  options={clientOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="billable"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                  <label className="text-sm font-bold text-gray-900">Billable</label>
                  <div className="flex items-center gap-3 h-10">
                    <Toggle enabled={field.value} onChange={field.onChange} />
                    <span className="text-sm text-gray-600">{field.value ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}
            />
            {billable && (
              <Controller
                name="billingType"
                control={control}
                rules={{ required: 'Choose how it is billed' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Billing Type"
                    placeholder="Select billing type"
                    options={BILLING_TYPE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.billingType?.message}
                  />
                )}
              />
            )}
          </div>
        )}

        {isClientProject && billable && billingType && (
          <Controller
            name="pricing"
            control={control}
            rules={{
              validate: (v, form) =>
                form.billingType
                  ? (pricingError(form.billingType, v, form.startDate, form.endDate) ?? true)
                  : true,
            }}
            render={({ field, fieldState }) => (
              <ProjectPricingFields
                type={billingType}
                value={field.value}
                onChange={field.onChange}
                startDate={startDate}
                endDate={endDate}
                error={fieldState.error?.message}
              />
            )}
          />
        )}

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            placeholder={`Brief overview of the ${labels.singularLower}`}
            rows={3}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="startDate"
            control={control}
            rules={{ required: 'Start date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Start Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.startDate?.message}
                disablePast
              />
            )}
          />
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="End Date"
                value={field.value}
                onChange={field.onChange}
                disablePast
              />
            )}
          />
        </div>

        <Controller
          name="budget"
          control={control}
          rules={{ min: { value: 0, message: 'Budget must be a positive number' } }}
          render={({ field }) => (
            <NumberField
              label={
                isClientProject && billable
                  ? 'Budget (GHS) — internal spending limit, optional'
                  : 'Budget (GHS)'
              }
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.budget?.message}
              placeholder="e.g. 50000"
            />
          )}
        />

        <Controller
          name="managerId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label={`${labels.singular} Owner`}
              placeholder="Select owner (optional)"
              options={managerOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {/* The set-up fields. A blank slate shows them straight away; a template starts them filled in and
            folded away, for this project only. The fields stay mounted while folded, so they still count. */}
        <Controller
          name="config"
          control={control}
          rules={{ validate: (v) => Object.keys(getProjectConfigErrors(v)).length === 0 }}
          render={({ field }) => {
            const fields = (
              <ProjectConfigFields
                value={field.value}
                onChange={field.onChange}
                showErrors={isSubmitted}
              />
            );
            if (!template) return fields;
            // Opens by itself if the set-up is invalid, so the error is never hidden.
            const open = setupOpen || !!errors.config;
            return (
              <div className="rounded-2xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setSetupOpen((v) => !v)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Template set-up</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                      open ? '' : '-rotate-90'
                    }`}
                  />
                </button>
                <div className={open ? 'flex flex-col gap-3 px-4 pb-4' : 'hidden'}>{fields}</div>
              </div>
            );
          }}
        />
      </div>
    </SidePanel>
  );
}
