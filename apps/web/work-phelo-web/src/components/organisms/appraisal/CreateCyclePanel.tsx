'use client';

import { useEffect, useRef, useState } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCreateAppraisalCycle, useUpdateAppraisalCycle, useAppraisalTemplates } from '@/hooks';
import { useDepartments } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { AppraisalCycle, CreateAppraisalCycleDto, Frequency } from '@/types/hr';
import { Icons } from '@/components/atoms/icons';

const FREQUENCY_OPTIONS = [
  { value: 'Annual', label: 'Annual' },
  { value: 'Semi-annual', label: 'Semi-annual' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Ad-hoc', label: 'Ad-hoc' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: AppraisalCycle;
}

type FormValues = {
  title: string;
  description: string;
  frequency: Frequency | '';
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  departmentIds: string[];
  employmentTypes: string[];
};

/* ── Applies-To multi-select (departments) ── */
function DepartmentSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = value.length === 0;
  const label = allSelected
    ? 'All departments'
    : `${value.length} department${value.length !== 1 ? 's' : ''} selected`;

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Departments</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className="text-gray-900">{label}</span>
        <Icons.ChevronDown
          className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange([])}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              <span
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  allSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {allSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              All Departments
            </button>
            {departments.map((dept) => {
              const checked = value.includes(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(dept.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                    )}
                  >
                    {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {dept.name}
                </button>
              );
            })}
            {departments.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No departments found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Employment type multi-select ── */
function EmploymentTypeSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (types: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = value.length === 0;
  const label = allSelected
    ? 'All employment types'
    : EMPLOYMENT_TYPE_OPTIONS.filter((o) => value.includes(o.value))
        .map((o) => o.label)
        .join(', ');

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((t) => t !== v) : [...value, v]);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Employment Type</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className="text-gray-900 truncate">{label}</span>
        <Icons.ChevronDown
          className={cn(
            'text-gray-400 transition-transform duration-150 shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange([])}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              <span
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  allSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {allSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              All Types
            </button>
            {EMPLOYMENT_TYPE_OPTIONS.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                    )}
                  >
                    {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main panel ── */
export function CreateCyclePanel({ isOpen, onClose, editCycle }: CreateCyclePanelProps) {
  const toast = useToast();
  const isEditing = !!editCycle;

  const { data: templates = [] } = useAppraisalTemplates();
  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequency: '',
      startDate: '',
      endDate: '',
      selfAssessmentDeadline: '',
      managerReviewDeadline: '',
      templateId: '',
      departmentIds: [],
      employmentTypes: [],
    },
  });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        description: editCycle.description ?? '',
        frequency: editCycle.frequency ?? '',
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline?.slice(0, 10) ?? '',
        managerReviewDeadline: editCycle.managerReviewDeadline?.slice(0, 10) ?? '',
        templateId: editCycle.templateId ?? '',
        departmentIds: editCycle.departmentIds ?? [],
        employmentTypes: editCycle.employmentTypes ?? [],
      });
    } else {
      reset({
        title: '',
        description: '',
        frequency: '',
        startDate: '',
        endDate: '',
        selfAssessmentDeadline: '',
        managerReviewDeadline: '',
        templateId: '',
        departmentIds: [],
        employmentTypes: [],
      });
    }
  }, [editCycle, reset, isOpen]);

  const startDate = useWatch({ control, name: 'startDate' });

  const { mutate: createCycle, isPending: isCreating } = useCreateAppraisalCycle();
  const { mutate: updateCycle, isPending: isUpdating } = useUpdateAppraisalCycle();
  const isPending = isCreating || isUpdating;

  const onSubmit = (values: FormValues) => {
    const payload: Partial<CreateAppraisalCycleDto> = {
      title: values.title,
      description: values.description || undefined,
      frequency: (values.frequency as Frequency) || undefined,
      startDate: values.startDate,
      endDate: values.endDate,
      selfAssessmentDeadline: values.selfAssessmentDeadline || undefined,
      managerReviewDeadline: values.managerReviewDeadline || undefined,
      templateId: values.templateId || undefined,
      departmentIds: values.departmentIds.length > 0 ? values.departmentIds : undefined,
      employmentTypes: values.employmentTypes.length > 0 ? values.employmentTypes : undefined,
    };

    const options = {
      onSuccess: () => {
        toast.success(isEditing ? 'Cycle updated' : 'Cycle created');
        onClose();
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Something went wrong')),
    };

    if (isEditing) {
      updateCycle({ id: editCycle!.id, ...payload }, options);
    } else {
      createCycle(payload, options);
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Appraisal Cycle' : 'Add New Appraisal Cycle'}
      description="Schedule a performance review cycle for your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Create Cycle'}
          </Button>
        </div>
      }
    >
      {/* Cycle name */}
      <FormField
        label="Cycle name"
        registration={register('title', { required: 'Cycle name is required' })}
        error={errors.title}
        placeholder="eg; 2026 Annual Review"
      />

      {/* Description */}
      <FormField
        label="Description"
        registration={register('description')}
        error={errors.description}
        placeholder="Optional description"
      />

      {/* Frequency */}
      {/* <Controller
        name="frequency"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Frequency"
            placeholder="Select frequency"
            options={FREQUENCY_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.frequency?.message}
          />
        )}
      /> */}

      {/* Start + End Date */}
      <div className="grid grid-cols-2 gap-4">
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
          rules={{
            required: 'End date is required',
            validate: (v) => !startDate || v >= startDate || 'Cannot be before start date',
          }}
          render={({ field }) => (
            <DatePicker
              label="End Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.endDate?.message}
              disablePast
            />
          )}
        />
      </div>

      {/* Self-assessment + Manager review deadline */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="selfAssessmentDeadline"
          control={control}
          render={({ field }) => (
            <DatePicker
              label="Self Assessment Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.selfAssessmentDeadline?.message}
              disablePast
            />
          )}
        />
        <Controller
          name="managerReviewDeadline"
          control={control}
          render={({ field }) => (
            <DatePicker
              label="Manager Review Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.managerReviewDeadline?.message}
              disablePast
            />
          )}
        />
      </div>

      {/* Template */}
      <Controller
        name="templateId"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Appraisal Template"
            placeholder="Select template (optional)"
            options={templateOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* Applies To — departments */}
      <Controller
        name="departmentIds"
        control={control}
        render={({ field }) => <DepartmentSelect value={field.value} onChange={field.onChange} />}
      />

      {/* Applies To — employment types */}
      <Controller
        name="employmentTypes"
        control={control}
        render={({ field }) => (
          <EmploymentTypeSelect value={field.value} onChange={field.onChange} />
        )}
      />
    </SidePanel>
  );
}
