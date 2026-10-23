'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { useToast } from '@/hooks/useToast';
import {
  useAppraisalGoalsStore,
  type CycleInput,
  type LocalCycle,
} from '@/store/appraisalGoals.store';

const FREQUENCY_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'AD_HOC', label: 'Ad-hoc' },
];

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: LocalCycle;
  forceCreate?: boolean;
}

type FormValues = CycleInput;

const EMPTY: FormValues = {
  title: '',
  description: '',
  frequency: '',
  startDate: '',
  endDate: '',
  selfAssessmentDeadline: '',
  managerReviewDeadline: '',
  goalIds: [],
};

export function CreateCyclePanel({
  isOpen,
  onClose,
  editCycle,
  forceCreate,
}: CreateCyclePanelProps) {
  const toast = useToast();
  const isEditing = !!editCycle && !forceCreate;

  const goals = useAppraisalGoalsStore((s) => s.goals);
  const addCycle = useAppraisalGoalsStore((s) => s.addCycle);
  const updateCycle = useAppraisalGoalsStore((s) => s.updateCycle);
  const goalOptions = goals.map((g) => ({ value: g.id, label: g.name }));

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: EMPTY });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        description: editCycle.description ?? '',
        frequency: editCycle.frequency,
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline.slice(0, 10),
        managerReviewDeadline: editCycle.managerReviewDeadline.slice(0, 10),
        goalIds: editCycle.goalIds,
      });
    } else {
      reset(EMPTY);
    }
  }, [editCycle, reset]);

  const startDate = useWatch({ control, name: 'startDate' });

  const onSubmit = (values: FormValues) => {
    if (!values.selfAssessmentDeadline || !values.managerReviewDeadline) {
      toast.error('Self-assessment and manager review deadlines are required');
      return;
    }
    if (isEditing) {
      updateCycle(editCycle!.id, values);
      toast.success('Cycle updated');
    } else {
      addCycle(values);
      toast.success('Cycle created');
    }
    reset(EMPTY);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? 'Edit Appraisal Cycle'
          : forceCreate
            ? 'New Cycle from Cancelled'
            : 'Add New Appraisal Cycle'
      }
      description="Schedule a performance review cycle for your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Create Cycle'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField
          label="Cycle name"
          registration={register('title', { required: 'Cycle name is required' })}
          error={errors.title}
          placeholder="eg; 2026 Annual Review"
        />

        <FormField
          label="Description"
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Controller
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
          />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <Controller
          name="goalIds"
          control={control}
          rules={{ validate: (v) => v.length > 0 || 'Pick at least one goal' }}
          render={({ field, fieldState }) => (
            <MultiSelect
              label="Goals"
              placeholder={
                goals.length === 0 ? 'No goals yet. Create one under Goals' : 'Select goals'
              }
              options={goalOptions}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
