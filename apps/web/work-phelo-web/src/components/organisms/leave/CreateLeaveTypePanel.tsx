'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { useCreateLeaveType, useUpdateLeaveType } from '@/hooks/useLeave';
import { LeaveType } from '@/types/leave';

interface CreateLeaveTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editLeaveType?: LeaveType;
}

type FormValues = {
  name: string;
  isPaid: 'yes' | 'no' | '';
  daysAllowed: number | '';
  isCarryOver: 'yes' | 'no' | '';
  maxCarryOverDays: number | '';
  requiresApproval: 'yes' | 'no' | '';
};

const emptyDefaults: FormValues = {
  name: '',
  isPaid: '',
  daysAllowed: '',
  isCarryOver: '',
  maxCarryOverDays: '',
  requiresApproval: '',
};

export function CreateLeaveTypePanel({
  isOpen,
  onClose,
  tenantSlug,
  editLeaveType,
}: CreateLeaveTypePanelProps) {
  const toast = useToast();
  const isEditing = !!editLeaveType;

  const { mutate: createLeaveType, isPending: isCreating } = useCreateLeaveType(tenantSlug);
  const { mutate: updateLeaveType, isPending: isUpdating } = useUpdateLeaveType(tenantSlug);
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyDefaults });

  useEffect(() => {
    if (editLeaveType) {
      reset({
        name: editLeaveType.name,
        isPaid: editLeaveType.isPaid ? 'yes' : 'no',
        daysAllowed: editLeaveType.daysAllowed,
        isCarryOver: editLeaveType.isCarryOver ? 'yes' : 'no',
        maxCarryOverDays: editLeaveType.maxCarryOverDays ?? '',
        requiresApproval: editLeaveType.requiresApproval ? 'yes' : 'no',
      });
    } else {
      reset(emptyDefaults);
    }
  }, [editLeaveType, reset]);

  const isCarryOver = useWatch({ control, name: 'isCarryOver' });

  const onSubmit = (values: FormValues) => {
    if (!values.isPaid || !values.isCarryOver || !values.requiresApproval) return;

    const payload = {
      name: values.name,
      isPaid: values.isPaid === 'yes',
      daysAllowed: Number(values.daysAllowed),
      isCarryOver: values.isCarryOver === 'yes',
      maxCarryOverDays:
        values.isCarryOver === 'yes' && values.maxCarryOverDays !== ''
          ? Number(values.maxCarryOverDays)
          : undefined,
      requiresApproval: values.requiresApproval === 'yes',
    };

    const handleSuccess = () => {
      toast.success(isEditing ? 'Leave type updated' : 'Leave type created');
      onClose();
    };

    const handleError = (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    };

    if (isEditing) {
      updateLeaveType(
        { id: editLeaveType!.id, ...payload },
        { onSuccess: handleSuccess, onError: handleError },
      );
    } else {
      createLeaveType(payload, { onSuccess: handleSuccess, onError: handleError });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Leave Type' : 'Add New Leave Type'}
      description="Define the leave type and its entitlement rules."
      width="w-[480px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add Leave Type'}
          </Button>
        </div>
      }
    >
      {/* Leave Type Name */}
      <FormField
        label="Leave Type Name"
        registration={register('name', { required: 'Leave type name is required' })}
        error={errors.name}
        placeholder="e.g. Sick Leave"
      />

      {/* Paid Leave */}
      <Controller
        name="isPaid"
        control={control}
        rules={{ required: 'Please select an option' }}
        render={({ field }) => (
          <SearchSelect
            label="Paid Leave"
            placeholder="Select option"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.isPaid?.message}
          />
        )}
      />

      {/* Days Entitled Per Year */}
      <FormField
        label="Days Allowed Per Year"
        registration={register('daysAllowed', {
          required: 'Days allowed is required',
          min: { value: 1, message: 'Must be at least 1' },
        })}
        error={errors.daysAllowed}
        type="number"
        placeholder="e.g. 10"
      />

      {/* Carry Over Allowed */}
      <Controller
        name="isCarryOver"
        control={control}
        rules={{ required: 'Please select an option' }}
        render={({ field }) => (
          <SearchSelect
            label="Carry Over Allowed"
            placeholder="Select option"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.isCarryOver?.message}
          />
        )}
      />

      {/* Max Carry Over Days — conditional */}
      {isCarryOver === 'yes' && (
        <FormField
          label="Maximum Carry Over Days"
          registration={register('maxCarryOverDays', {
            min: { value: 1, message: 'Must be at least 1' },
          })}
          error={errors.maxCarryOverDays}
          type="number"
          placeholder="e.g. 5"
        />
      )}

      {/* Requires Approval */}
      <Controller
        name="requiresApproval"
        control={control}
        rules={{ required: 'Please select an option' }}
        render={({ field }) => (
          <SearchSelect
            label="Requires Approval"
            placeholder="Select option"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.requiresApproval?.message}
          />
        )}
      />
    </SidePanel>
  );
}
