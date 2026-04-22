'use client';

import { useEffect, useRef, useState } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCreateAppraisalCycle, useUpdateAppraisalCycle } from '@/hooks/useAppraisals';
import { useDepartments } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AppraisalCycle, CreateAppraisalCycleDto, Frequency } from '@/types/hr';
import { Icons } from '@/components/atoms/icons';

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: AppraisalCycle;
}

type FormValues = {
  title: string;
  frequency: Frequency | '';
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  departmentIds: string[];
};

const FREQUENCY_OPTIONS = [
  { value: 'Annual', label: 'Annual' },
  { value: 'Semi-annual', label: 'Semi-annual' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Ad-hoc', label: 'Ad-hoc' },
];

/* ── Applies-To multi-select ── */
function AppliesToSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = value.length === 0;

  const toggleAll = () => onChange([]);

  const toggleDept = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const displayLabel = allSelected
    ? 'All employees'
    : `${value.length} department${value.length !== 1 ? 's' : ''} selected`;

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      <label className="text-sm font-bold text-gray-900">Applies To</label>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className={allSelected ? 'text-gray-900' : 'text-gray-900'}>{displayLabel}</span>
        <Icons.ChevronDown
          className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {/* All Employees option */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleAll}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  allSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {allSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              All Employees
            </button>

            {/* Department options */}
            {departments.map((dept) => {
              const checked = value.includes(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
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

/* ── Main panel ── */
export function CreateCyclePanel({ isOpen, onClose, editCycle }: CreateCyclePanelProps) {
  const toast = useToast();
  const isEditing = !!editCycle;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      frequency: '',
      startDate: '',
      endDate: '',
      selfAssessmentDeadline: '',
      managerReviewDeadline: '',
      templateId: '',
      departmentIds: [],
    },
  });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        frequency: editCycle.frequency ?? '',
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline?.slice(0, 10) ?? '',
        managerReviewDeadline: editCycle.managerReviewDeadline?.slice(0, 10) ?? '',
        templateId: editCycle.templateId ?? '',
        departmentIds: editCycle.departmentIds ?? [],
      });
    } else {
      reset({
        title: '',
        frequency: '',
        startDate: '',
        endDate: '',
        selfAssessmentDeadline: '',
        managerReviewDeadline: '',
        templateId: '',
        departmentIds: [],
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
      frequency: values.frequency as Frequency,
      startDate: values.startDate,
      endDate: values.endDate,
      selfAssessmentDeadline: values.selfAssessmentDeadline,
      managerReviewDeadline: values.managerReviewDeadline,
      templateId: values.templateId || undefined,
      departmentIds: values.departmentIds.length > 0 ? values.departmentIds : undefined,
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
      {/* Cycle Name */}
      <FormField
        label="Cycle name"
        registration={register('title', { required: 'Cycle name is required' })}
        error={errors.title}
        placeholder="eg; 2026 Annual Review"
      />

      {/* Frequency */}
      <Controller
        name="frequency"
        control={control}
        rules={{ required: 'Frequency is required' }}
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
      />

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
            />
          )}
        />
      </div>

      {/* Self Assessment + Manager Review Deadline */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="selfAssessmentDeadline"
          control={control}
          rules={{ required: 'Self assessment deadline is required' }}
          render={({ field }) => (
            <DatePicker
              label="Self Assessment Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.selfAssessmentDeadline?.message}
            />
          )}
        />
        <Controller
          name="managerReviewDeadline"
          control={control}
          rules={{ required: 'Manager review deadline is required' }}
          render={({ field }) => (
            <DatePicker
              label="Manager Review Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.managerReviewDeadline?.message}
            />
          )}
        />
      </div>

      {/* Appraisal Template */}
      <Controller
        name="templateId"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Appraisal Template"
            placeholder="Select Template"
            options={[]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* Applies To */}
      <Controller
        name="departmentIds"
        control={control}
        render={({ field }) => <AppliesToSelect value={field.value} onChange={field.onChange} />}
      />
    </SidePanel>
  );
}
