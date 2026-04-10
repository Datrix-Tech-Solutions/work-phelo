'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useToast } from '@/hooks/useToast';
import { PublicHoliday } from '@/types/leave';
import { useCreatePublicHoliday, useUpdatePublicHoliday } from '@/hooks';

interface CreatePublicHolidayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug?: string;
  editHoliday?: PublicHoliday;
}

type FormValues = {
  name: string;
  date: string;
};

export function CreatePublicHolidayPanel({
  isOpen,
  onClose,
  tenantSlug,
  editHoliday,
}: CreatePublicHolidayPanelProps) {
  const toast = useToast();
  const isEditing = !!editHoliday;

  const { mutate: create, isPending: isCreating } = useCreatePublicHoliday();
  const { mutate: update, isPending: isUpdating } = useUpdatePublicHoliday();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '', date: '' },
  });

  useEffect(() => {
    if (editHoliday) {
      reset({ name: editHoliday.name, date: editHoliday.date });
    } else {
      reset({ name: '', date: '' });
    }
  }, [editHoliday, reset]);

  const onSubmit = (values: FormValues) => {
    if (isEditing) {
      update(
        { id: editHoliday!.id, name: values.name, date: values.date },
        {
          onSuccess: () => {
            toast.success('Holiday updated');
            onClose();
          },
          onError: (err: any) =>
            toast.error(err?.response?.data?.message ?? 'Something went wrong'),
        },
      );
    } else {
      create(
        { name: values.name, date: values.date },
        {
          onSuccess: () => {
            toast.success('Holiday added');
            onClose();
          },
          onError: (err: any) =>
            toast.error(err?.response?.data?.message ?? 'Something went wrong'),
        },
      );
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Public Holiday' : 'Add Public Holiday'}
      description="Public holidays are automatically excluded from leave day calculations."
      width="w-[480px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add Holiday'}
          </Button>
        </div>
      }
    >
      <FormField
        label="Holiday Name"
        registration={register('name', { required: 'Holiday name is required' })}
        error={errors.name}
        placeholder="e.g. Christmas Day"
      />

      <Controller
        name="date"
        control={control}
        rules={{ required: 'Date is required' }}
        render={({ field }) => (
          <DatePicker
            label="Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.date?.message}
          />
        )}
      />
    </SidePanel>
  );
}
