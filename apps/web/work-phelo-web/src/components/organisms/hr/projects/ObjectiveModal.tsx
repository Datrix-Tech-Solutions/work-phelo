'use client';

import { useForm } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { inputClass } from '@/lib/utils';
import { ProjectObjective } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  /** The objective being edited; leave out to create one. Remount (key) when it changes. */
  objective?: ProjectObjective;
}

type FormValues = { name: string; description: string };

export function ObjectiveModal({ isOpen, onClose, onSubmit, objective }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: objective?.name ?? '', description: objective?.description ?? '' },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onValid = (values: FormValues) => {
    onSubmit({ name: values.name.trim(), description: values.description.trim() || undefined });
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={objective ? 'Edit Objective' : 'New Objective'}
      description="An objective groups the tasks that work towards the same goal."
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onValid)}>
            {objective ? 'Save Changes' : 'Create Objective'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 mt-4">
        <FormField
          label="Objective Name"
          registration={register('name', { required: 'Objective name is required' })}
          error={errors.name}
          placeholder="e.g. Launch the beta"
        />
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            placeholder="What does this objective aim to achieve?"
            rows={3}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>
      </div>
    </Modal>
  );
}
