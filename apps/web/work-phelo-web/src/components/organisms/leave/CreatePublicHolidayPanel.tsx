'use client';

import { useEffect, useCallback } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { MonthDayPicker } from '@/components/atoms/MonthDayPicker';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useToast } from '@/hooks/useToast';
import { PublicHoliday } from '@/types/hr';
import { useCreatePublicHoliday, useUpdatePublicHoliday } from '@/hooks';
import { cn } from '@/lib/utils';

interface CreatePublicHolidayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug?: string;
  editHoliday?: PublicHoliday;
}

type HolidayType = 'recurring' | 'specific';

type FormValues = {
  name: string;
  date: string;
  holidayType: HolidayType;
};

function detectType(date: string | undefined): HolidayType {
  if (!date) return 'recurring';
  return date.length === 5 && date[2] === '-' ? 'recurring' : 'specific';
}

export function CreatePublicHolidayPanel({
  isOpen,
  onClose,
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '', date: '', holidayType: 'recurring' },
  });

  const holidayType = useWatch({ control, name: 'holidayType' });

  useEffect(() => {
    if (editHoliday) {
      reset({
        name: editHoliday.name,
        date: editHoliday.date,
        holidayType: detectType(editHoliday.date),
      });
    } else {
      reset({ name: '', date: '', holidayType: 'recurring' });
    }
  }, [editHoliday, reset]);

  const handleClose = useCallback(() => {
    reset({ name: '', date: '', holidayType: 'recurring' });
    onClose();
  }, [reset, onClose]);

  const onSubmit = (values: FormValues) => {
    const payload = { name: values.name, date: values.date };
    if (isEditing) {
      update(
        { id: editHoliday!.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Holiday updated');
            handleClose();
          },
          onError: (err: unknown) =>
            toast.error(
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Something went wrong',
            ),
        },
      );
    } else {
      create(payload, {
        onSuccess: () => {
          toast.success('Holiday added');
          handleClose();
        },
        onError: (err: unknown) =>
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Something went wrong',
          ),
      });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Public Holiday' : 'Add Public Holiday'}
      description="Public holidays are automatically excluded from leave day calculations."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Holiday Type</label>
        <Controller
          name="holidayType"
          control={control}
          render={({ field }) => (
            <div className="flex rounded-input border border-gray-300 overflow-hidden">
              {(['recurring', 'specific'] as HolidayType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    field.onChange(type);
                    setValue('date', '');
                  }}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-medium transition-colors',
                    field.value === type ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {type === 'recurring' ? 'Recurring yearly' : 'Specific year'}
                </button>
              ))}
            </div>
          )}
        />
        <p className="text-xs text-gray-400">
          {holidayType === 'recurring'
            ? 'Repeats on the same day every year (e.g. Christmas, Independence Day).'
            : 'Falls on a different date each year (e.g. Easter, Eid).'}
        </p>
      </div>

      <Controller
        name="date"
        control={control}
        rules={{ required: 'Date is required' }}
        render={({ field }) =>
          holidayType === 'recurring' ? (
            <MonthDayPicker
              label="Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.date?.message}
            />
          ) : (
            <DatePicker
              label="Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.date?.message}
            />
          )
        }
      />
    </SidePanel>
  );
}
