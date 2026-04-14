'use client';

import { useEffect } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { useToast } from '@/hooks/useToast';
import { useCreateLeaveType, useUpdateLeaveType } from '@/hooks/useLeave';
import { LeaveType, LeaveApplicableTo } from '@/types/leave';

interface CreateLeaveTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editLeaveType?: LeaveType;
}

type FormValues = {
  name: string;
  isPaid: boolean;
  daysAllowed: number | '';
  isCarryOver: boolean;
  maxCarryOverDays: number | '';
  requiresApproval: boolean;
  applicableTo: LeaveApplicableTo[];
};

const EMPLOYMENT_TYPES: { value: LeaveApplicableTo; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
];

const ALL_SPECIFIC = EMPLOYMENT_TYPES.map((t) => t.value);

const emptyDefaults: FormValues = {
  name: '',
  isPaid: false,
  daysAllowed: '',
  isCarryOver: false,
  maxCarryOverDays: '',
  requiresApproval: true,
  applicableTo: ['ALL', ...ALL_SPECIFIC],
};

/* ── Toggle ── */
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        enabled ? 'bg-brand' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/* ── Toggle Row ── */
function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="text-xs text-gray-400">{description}</span>}
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

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
      const applicable = editLeaveType.applicableTo?.length
        ? editLeaveType.applicableTo
        : (['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]);
      reset({
        name: editLeaveType.name,
        isPaid: editLeaveType.isPaid,
        daysAllowed: editLeaveType.daysAllowed,
        isCarryOver: editLeaveType.isCarryOver,
        maxCarryOverDays: editLeaveType.maxCarryOverDays ?? '',
        requiresApproval: editLeaveType.requiresApproval,
        applicableTo: applicable,
      });
    } else {
      reset(emptyDefaults);
    }
  }, [editLeaveType, reset]);

  const isCarryOver = useWatch({ control, name: 'isCarryOver' });

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      isPaid: values.isPaid,
      daysAllowed: Number(values.daysAllowed),
      isCarryOver: values.isCarryOver,
      maxCarryOverDays:
        values.isCarryOver && values.maxCarryOverDays !== ''
          ? Number(values.maxCarryOverDays)
          : undefined,
      requiresApproval: values.requiresApproval,
      applicableTo: values.applicableTo,
    };

    const handleSuccess = () => {
      toast.success(isEditing ? 'Leave type updated' : 'Leave type created');
      onClose();
    };
    const handleError = (err: unknown) => {
      toast.error(extractError(err, 'Something went wrong'));
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

      {/* Days Allowed */}
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

      {/* Toggle fields */}
      <div className="flex flex-col gap-5 py-2">
        <Controller
          name="isPaid"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Paid Leave"
              description="Employees are paid during this leave"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="requiresApproval"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Requires Approval"
              description="Manager must approve before leave is confirmed"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="isCarryOver"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Carry Over Allowed"
              description="Unused days can roll over to the next year"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Max Carry Over Days — conditional */}
      {isCarryOver && (
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

      {/* Applicable To */}
      <Controller
        name="applicableTo"
        control={control}
        render={({ field }) => {
          const selected = field.value;
          const allChecked = ALL_SPECIFIC.every((t) => selected.includes(t));

          const toggleAll = () => {
            if (allChecked) {
              field.onChange([]);
            } else {
              field.onChange(['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]);
            }
          };

          const toggleType = (type: LeaveApplicableTo) => {
            let next: LeaveApplicableTo[];
            if (selected.includes(type)) {
              next = selected.filter((t) => t !== type && t !== 'ALL');
            } else {
              const withNew = [...selected.filter((t) => t !== 'ALL'), type];
              const allNowSelected = ALL_SPECIFIC.every((t) => withNew.includes(t));
              next = allNowSelected ? (['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]) : withNew;
            }
            field.onChange(next);
          };

          return (
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-sm font-medium text-gray-900">Applicable To</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select which employment types this leave applies to
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* All Employees */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-brand shrink-0"
                  />
                  <span className="text-sm text-gray-700 font-medium">All Employees</span>
                </label>
                {/* Individual types */}
                <div className="ml-7 flex flex-col gap-2.5">
                  {EMPLOYMENT_TYPES.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.includes(value)}
                        onChange={() => toggleType(value)}
                        className="w-4 h-4 rounded accent-brand shrink-0"
                      />
                      <span className="text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        }}
      />
    </SidePanel>
  );
}
