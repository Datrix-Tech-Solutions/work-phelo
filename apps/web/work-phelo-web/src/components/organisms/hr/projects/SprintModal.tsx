'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect, MultiSelectOption } from '@/components/atoms/MultiSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import type { SprintInput } from '@/hooks/hr/useProjectWork';
import type { ProjectSprint } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SprintInput) => void;
  /** The tasks that can go in this sprint: those not already in another one. */
  taskOptions: MultiSelectOption[];
  /** The sprint being edited; leave out to create one. Remount (key) when it changes. */
  sprint?: ProjectSprint;
}

type FormValues = SprintInput;

export function SprintModal({ isOpen, onClose, onSubmit, taskOptions, sprint }: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: sprint?.name ?? '',
      startDate: sprint?.startDate ?? '',
      endDate: sprint?.endDate ?? '',
      taskIds: sprint?.taskIds ?? [],
    },
  });
  const startDate = useWatch({ control, name: 'startDate' });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onValid = (values: FormValues) => {
    onSubmit({ ...values, name: values.name.trim() });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={sprint ? 'Edit Sprint' : 'New Sprint'}
      description="A sprint is a set of tasks to finish between a start date and an end date."
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onValid)}>
            {sprint ? 'Save Changes' : 'Create Sprint'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 mt-4">
        <FormField
          label="Sprint Name"
          registration={register('name', { required: 'Sprint name is required' })}
          error={errors.name}
          placeholder="e.g. Sprint 1"
        />

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
              />
            )}
          />
          <Controller
            name="endDate"
            control={control}
            rules={{
              required: 'End date is required',
              validate: (v) => !startDate || v >= startDate || 'End date is before the start date',
            }}
            render={({ field }) => (
              <DatePicker
                label="End Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.endDate?.message}
                minDate={startDate || undefined}
              />
            )}
          />
        </div>

        <Controller
          name="taskIds"
          control={control}
          render={({ field }) => (
            <MultiSelect
              label="Tasks"
              placeholder={
                taskOptions.length === 0 ? 'No tasks available' : 'Pick the tasks to include'
              }
              options={taskOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </Modal>
  );
}
