'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CreatePublicHolidayDto, PublicHoliday } from '@/types/leave';

interface CreatePublicHolidayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
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
  const queryClient = useQueryClient();
  const isEditing = !!editHoliday;

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
      reset({
        name: editHoliday.name,
        date: editHoliday.date,
      });
    } else {
      reset({ name: '', date: '' });
    }
  }, [editHoliday, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreatePublicHolidayDto) =>
      isEditing
        ? api.patch(`/hr/leave/public-holidays/${editHoliday!.id}`, data)
        : api.post(`/hr/leave/public-holidays`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays', tenantSlug] });
      toast.success(isEditing ? 'Holiday updated' : 'Holiday added');
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
    mutate({
      name: values.name,
      date: values.date,
    });
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
      {/* Holiday Name */}
      <FormField
        label="Holiday Name"
        registration={register('name', { required: 'Holiday name is required' })}
        error={errors.name}
        placeholder="e.g. Christmas Day"
      />

      {/* Date */}
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
