'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import {
  AppraisalCycle,
  AppraisalTemplate,
  CreateAppraisalCycleDto,
  Frequency,
} from '@/types/appraisal';

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editCycle?: AppraisalCycle;
}

type FormValues = {
  name: string;
  frequency: Frequency | '';
  description: string;
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  appliesTo: 'all' | 'specific';
  targetDepartmentIds: string[];
};

// Simple multi-select for departments
function DepartmentMultiSelect({
  departments,
  selected,
  onChange,
}: {
  departments: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-gray-900">Departments</label>
      <div className="border border-gray-300 rounded-input p-3 flex flex-col gap-2 max-h-44 overflow-y-auto">
        {departments.length === 0 && <p className="text-sm text-gray-400">No departments found</p>}
        {departments.map((dept) => (
          <label key={dept.id} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(dept.id)}
              onChange={() => toggle(dept.id)}
              className="w-4 h-4 accent-[#0D2244]"
            />
            <span className="text-sm text-gray-700">{dept.name}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-400">{selected.length} department(s) selected</p>
      )}
    </div>
  );
}

export function CreateCyclePanel({
  isOpen,
  onClose,
  tenantSlug,
  editCycle,
}: CreateCyclePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editCycle;
  const isInProgress = editCycle?.status === 'InProgress';

  const { data: templates = [] } = useQuery<AppraisalTemplate[]>({
    queryKey: ['appraisal-templates', tenantSlug],
    queryFn: () => api.get('/hr/appraisals/templates').then((r) => r.data),
    enabled: isOpen,
  });

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments', tenantSlug],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      frequency: '',
      description: '',
      startDate: '',
      endDate: '',
      selfAssessmentDeadline: '',
      managerReviewDeadline: '',
      templateId: '',
      appliesTo: 'all',
      targetDepartmentIds: [],
    },
  });

  useEffect(() => {
    if (editCycle) {
      reset({
        name: editCycle.name,
        frequency: editCycle.frequency,
        description: editCycle.description,
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline.slice(0, 10),
        managerReviewDeadline: editCycle.managerReviewDeadline.slice(0, 10),
        templateId: editCycle.templateId,
        appliesTo: editCycle.isAllDepartments ? 'all' : 'specific',
        targetDepartmentIds: editCycle.targetDepartmentIds,
      });
    } else {
      reset({
        name: '',
        frequency: '',
        description: '',
        startDate: '',
        endDate: '',
        selfAssessmentDeadline: '',
        managerReviewDeadline: '',
        templateId: '',
        appliesTo: 'all',
        targetDepartmentIds: [],
      });
    }
  }, [editCycle, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const appliesTo = watch('appliesTo');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const selfDeadline = watch('selfAssessmentDeadline');
  const locked = isInProgress; // non-deadline fields locked when in progress

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateAppraisalCycleDto) =>
      isEditing
        ? api.put(`/hr/appraisals/cycles/${editCycle!.id}`, data)
        : api.post('/hr/appraisals/cycles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles', tenantSlug] });
      toast.success(isEditing ? 'Cycle updated' : 'Cycle created');
      onClose();
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!values.frequency || !values.templateId) return;
    mutate({
      tenantSlug,
      name: values.name,
      frequency: values.frequency as Frequency,
      description: values.description,
      startDate: values.startDate,
      endDate: values.endDate,
      selfAssessmentDeadline: values.selfAssessmentDeadline,
      managerReviewDeadline: values.managerReviewDeadline,
      templateId: values.templateId,
      isAllDepartments: values.appliesTo === 'all',
      targetDepartmentIds: values.appliesTo === 'specific' ? values.targetDepartmentIds : [],
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Cycle' : 'New Appraisal Cycle'}
      description={
        locked
          ? 'This cycle is in progress — only deadlines can be updated.'
          : 'Schedule a performance review cycle for your organisation.'
      }
      width="w-[560px]"
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
        label="Cycle Name"
        registration={register('name', { required: 'Cycle name is required' })}
        error={errors.name}
        placeholder="e.g. Annual Review 2026"
        readOnly={locked}
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
            options={[
              { value: 'Annual', label: 'Annual' },
              { value: 'Semi-annual', label: 'Semi-annual' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Ad-hoc', label: 'Ad-hoc' },
            ]}
            value={field.value}
            onChange={locked ? undefined : field.onChange}
            error={errors.frequency?.message}
          />
        )}
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Description</label>
        <textarea
          {...register('description')}
          placeholder="Brief description of this appraisal cycle"
          rows={3}
          readOnly={locked}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

      {/* Cycle Dates */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="startDate"
          control={control}
          rules={{ required: 'Start date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Start Date"
              value={field.value}
              onChange={locked ? undefined : field.onChange}
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
              onChange={locked ? undefined : field.onChange}
              error={errors.endDate?.message}
            />
          )}
        />
      </div>

      {/* Deadlines */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="selfAssessmentDeadline"
          control={control}
          rules={{
            required: 'Required',
            validate: (v) => {
              if (startDate && v < startDate) return 'Must be after start date';
              if (endDate && v > endDate) return 'Must be before end date';
              return true;
            },
          }}
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
          rules={{
            required: 'Required',
            validate: (v) => {
              if (selfDeadline && v <= selfDeadline) return 'Must be after self assessment';
              if (endDate && v > endDate) return 'Must be before end date';
              return true;
            },
          }}
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

      {/* Template */}
      <Controller
        name="templateId"
        control={control}
        rules={{ required: 'Template is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Appraisal Template"
            placeholder="Search templates..."
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            value={field.value}
            onChange={locked ? undefined : field.onChange}
            error={errors.templateId?.message}
          />
        )}
      />

      {/* Applies To */}
      <Controller
        name="appliesTo"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Applies To"
            options={[
              { value: 'all', label: 'All Employees' },
              { value: 'specific', label: 'Specific Departments' },
            ]}
            value={field.value}
            onChange={locked ? undefined : field.onChange}
          />
        )}
      />

      {/* Department multi-select — only when specific */}
      {appliesTo === 'specific' && !locked && (
        <Controller
          name="targetDepartmentIds"
          control={control}
          rules={{ validate: (v) => (v && v.length > 0) || 'Select at least one department' }}
          render={({ field }) => (
            <div>
              <DepartmentMultiSelect
                departments={departments}
                selected={field.value ?? []}
                onChange={field.onChange}
              />
              {errors.targetDepartmentIds && (
                <p className="text-xs text-red-500 mt-1">{errors.targetDepartmentIds.message}</p>
              )}
            </div>
          )}
        />
      )}
    </SidePanel>
  );
}
