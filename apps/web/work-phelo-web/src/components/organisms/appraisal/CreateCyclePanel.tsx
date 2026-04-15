'use client';

import { useEffect } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useCreateAppraisalCycle, useUpdateAppraisalCycle } from '@/hooks/useAppraisals';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { AppraisalCycle, CreateAppraisalCycleDto } from '@/types/hr';

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: AppraisalCycle;
}

type FormValues = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
};

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
      description: '',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        description: editCycle.description ?? '',
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
      });
    } else {
      reset({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
      });
    }
  }, [editCycle, reset]);

  const startDate = useWatch({ control, name: 'startDate' });

  const { mutate: createCycle, isPending: isCreating } = useCreateAppraisalCycle();
  const { mutate: updateCycle, isPending: isUpdating } = useUpdateAppraisalCycle();
  const isPending = isCreating || isUpdating;

  const onSubmit = (values: FormValues) => {
    const payload: Partial<CreateAppraisalCycleDto> = {
      title: values.title,
      description: values.description || undefined,
      startDate: values.startDate,
      endDate: values.endDate,
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
      title={isEditing ? 'Edit Cycle' : 'New Appraisal Cycle'}
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
      {/* Cycle Title */}
      <FormField
        label="Cycle Name"
        registration={register('title', { required: 'Cycle name is required' })}
        error={errors.title}
        placeholder="e.g. Annual Review 2026"
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          placeholder="Brief description of this appraisal cycle"
          rows={3}
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
    </SidePanel>
  );
}
