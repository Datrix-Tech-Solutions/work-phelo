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
  startDate: string;
  endDate: string;
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
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '', startDate: '', endDate: '' },
  });

  useEffect(() => {
    if (editHoliday) {
      reset({
        name: editHoliday.name,
        startDate: editHoliday.startDate,
        endDate: editHoliday.endDate,
      });
    } else {
      reset({ name: '', startDate: '', endDate: '' });
    }
  }, [editHoliday, reset]);

  const startDate = watch('startDate');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreatePublicHolidayDto) =>
      isEditing
        ? api.put(`/${tenantSlug}/public-holidays/${editHoliday!.id}`, data)
        : api.post(`/${tenantSlug}/public-holidays`, data),
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
      startDate: values.startDate,
      endDate: values.endDate,
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
      {/* Date range */}
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

      {/* Holiday name */}
      <FormField
        label="Holiday Name"
        registration={register('name', { required: 'Holiday name is required' })}
        error={errors.name}
        placeholder="e.g. Christmas Day"
      />
    </SidePanel>
  );
}
