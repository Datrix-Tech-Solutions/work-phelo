'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { CreateLeaveTypeDto, LeaveApplicability, LeaveType } from '@/types/leave';

interface CreateLeaveTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editLeaveType?: LeaveType;
}

type FormValues = {
  name: string;
  description: string;
  isPaid: 'yes' | 'no' | '';
  daysPerYear: number | '';
  carryOver: 'yes' | 'no' | '';
  maxCarryOverDays: number | '';
  requiresDocumentation: 'yes' | 'no' | '';
  documentationDescription: string;
  applicableTo: LeaveApplicability[];
};

const APPLICABILITY_OPTIONS: { value: LeaveApplicability; label: string }[] = [
  { value: 'All', label: 'All Employees' },
  { value: 'FullTime', label: 'Full-time' },
  { value: 'PartTime', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
];

export function CreateLeaveTypePanel({
  isOpen,
  onClose,
  tenantSlug,
  editLeaveType,
}: CreateLeaveTypePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editLeaveType;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      isPaid: '',
      daysPerYear: '',
      carryOver: '',
      maxCarryOverDays: '',
      requiresDocumentation: '',
      documentationDescription: '',
      applicableTo: [],
    },
  });

  useEffect(() => {
    if (editLeaveType) {
      reset({
        name: editLeaveType.name,
        description: editLeaveType.description ?? '',
        isPaid: editLeaveType.isPaid ? 'yes' : 'no',
        daysPerYear: editLeaveType.daysPerYear,
        carryOver: editLeaveType.carryOver ? 'yes' : 'no',
        maxCarryOverDays: editLeaveType.maxCarryOverDays ?? '',
        requiresDocumentation: editLeaveType.requiresDocumentation ? 'yes' : 'no',
        documentationDescription: editLeaveType.documentationDescription ?? '',
        applicableTo: editLeaveType.applicableTo,
      });
    } else {
      reset({
        name: '',
        description: '',
        isPaid: '',
        daysPerYear: '',
        carryOver: '',
        maxCarryOverDays: '',
        requiresDocumentation: '',
        documentationDescription: '',
        applicableTo: [],
      });
    }
  }, [editLeaveType, reset]);

  const carryOver = watch('carryOver');
  const requiresDocumentation = watch('requiresDocumentation');
  const applicableTo = watch('applicableTo');

  const toggleApplicability = (value: LeaveApplicability) => {
    const current = applicableTo ?? [];
    if (current.includes(value)) {
      setValue(
        'applicableTo',
        current.filter((v) => v !== value),
        { shouldValidate: true },
      );
    } else {
      setValue('applicableTo', [...current, value], { shouldValidate: true });
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateLeaveTypeDto) =>
      isEditing
        ? api.put(`/${tenantSlug}/leave-types/${editLeaveType!.id}`, data)
        : api.post(`/${tenantSlug}/leave-types`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types', tenantSlug] });
      toast.success(isEditing ? 'Leave type updated' : 'Leave type created');
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
    if (!values.isPaid || !values.carryOver || !values.requiresDocumentation) return;
    if ((values.applicableTo ?? []).length === 0) {
      toast.error('Select at least one applicability option');
      return;
    }
    mutate({
      name: values.name,
      description: values.description || undefined,
      isPaid: values.isPaid === 'yes',
      daysPerYear: Number(values.daysPerYear),
      carryOver: values.carryOver === 'yes',
      maxCarryOverDays:
        values.carryOver === 'yes' && values.maxCarryOverDays !== ''
          ? Number(values.maxCarryOverDays)
          : undefined,
      requiresDocumentation: values.requiresDocumentation === 'yes',
      documentationDescription:
        values.requiresDocumentation === 'yes' && values.documentationDescription
          ? values.documentationDescription
          : undefined,
      applicableTo: values.applicableTo,
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Leave Type' : 'Add New Leave Type'}
      description="Define the leave type and its entitlement rules."
      width="w-[520px]"
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

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Description</label>
        <textarea
          {...register('description')}
          placeholder="Optional"
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

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
        label="Days Entitled Per Year"
        registration={register('daysPerYear', {
          required: 'Days per year is required',
          min: { value: 1, message: 'Must be at least 1' },
        })}
        error={errors.daysPerYear}
        type="number"
        placeholder="e.g. 10"
      />

      {/* Carry Over Allowed */}
      <Controller
        name="carryOver"
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
            error={errors.carryOver?.message}
          />
        )}
      />

      {/* Max Carry Over Days — conditional */}
      {carryOver === 'yes' && (
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

      {/* Requires Documentation */}
      <Controller
        name="requiresDocumentation"
        control={control}
        rules={{ required: 'Please select an option' }}
        render={({ field }) => (
          <SearchSelect
            label="Requires Documentation"
            placeholder="Select option"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.requiresDocumentation?.message}
          />
        )}
      />

      {/* Documentation Description — conditional */}
      {requiresDocumentation === 'yes' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Documentation Description</label>
          <textarea
            {...register('documentationDescription')}
            placeholder="Describe what documentation is required"
            rows={3}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>
      )}

      {/* Applicable To */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-gray-900">Applicable To</label>
        <div className="flex flex-col gap-2.5">
          {APPLICABILITY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(applicableTo ?? []).includes(opt.value)}
                onChange={() => toggleApplicability(opt.value)}
                className="w-4 h-4 accent-[#0D2244]"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
        {(applicableTo ?? []).length === 0 && errors.applicableTo && (
          <p className="text-xs text-red-500">Select at least one option</p>
        )}
      </div>
    </SidePanel>
  );
}
