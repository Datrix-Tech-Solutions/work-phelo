'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { LeaveBalanceBar } from '@/components/molecules/hr/leave/LeaveBalanceBar';
import { calcWorkingDays } from '@/components/organisms/hr/leave/ApplyLeavePanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';
import {
  useLeaveTypes,
  useLeaveBalances,
  useCreateLeaveRequestOnBehalf,
} from '@/hooks/hr/useLeave';
import { usePublicHolidays } from '@/hooks/hr/usePublicHolidays';
import { useMyProfile, useEmployeeOptions } from '@/hooks';

interface RecordLeavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
}

type FormValues = {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  coverageEmployeeId?: string;
};

const EMPTY: FormValues = {
  employeeId: '',
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  reason: '',
  coverageEmployeeId: '',
};

/**
 * Records leave for another employee. There is no approval step: it is saved as approved and
 * the days come off the employee's balance straight away. Opened from the leave requests page,
 * which already needs leave:APPROVE.
 */
export function RecordLeavePanel({ isOpen, onClose, tenantSlug }: RecordLeavePanelProps) {
  const toast = useToast();
  const { data: leaveTypes = [] } = useLeaveTypes(tenantSlug);
  const { data: holidays = [] } = usePublicHolidays();
  const { data: myProfile } = useMyProfile();
  const { data: allEmployees = [] } = useEmployeeOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: EMPTY });

  const employeeId = useWatch({ control, name: 'employeeId' });
  const leaveTypeId = useWatch({ control, name: 'leaveTypeId' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  useEffect(() => {
    if (isOpen) reset(EMPTY);
  }, [isOpen, reset]);

  const handleClose = useCallback(() => {
    reset(EMPTY);
    onClose();
  }, [reset, onClose]);

  // Leave can only be recorded for someone else, and only for active or probationary staff.
  const employeeOptions = useMemo(
    () =>
      allEmployees
        .filter(
          (e) =>
            e.id !== myProfile?.id &&
            (e.employmentStatus === 'ACTIVE' || e.employmentStatus === 'PROBATION'),
        )
        .map((e) => ({
          value: e.id,
          label: `${e.firstName} ${e.lastName}`,
          sublabel: e.jobTitle,
        })),
    [allEmployees, myProfile?.id],
  );

  const coverOptions = useMemo(
    () => employeeOptions.filter((o) => o.value !== employeeId),
    [employeeOptions, employeeId],
  );

  // Balances need leave:VIEW, so they are a nice-to-have: the bar simply stays hidden without it.
  const { data: balances = [] } = useLeaveBalances(employeeId || undefined, {
    enabled: isOpen && Boolean(employeeId),
  });
  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
  const selectedLeaveType = leaveTypes.find((t) => t.id === leaveTypeId);

  const workingDays = useMemo(
    () => calcWorkingDays(startDate, endDate, holidays),
    [startDate, endDate, holidays],
  );
  const isOverBalance =
    selectedBalance != null && workingDays > 0 && workingDays > selectedBalance.remaining;

  const { mutate, isPending } = useCreateLeaveRequestOnBehalf();

  const onSubmit = (values: FormValues) => {
    // Nobody reviews this leave, so a required document has to come with it, and there is no
    // way to attach a stored document from this panel yet.
    if (selectedLeaveType?.requiresDocument) {
      setError('leaveTypeId', {
        message:
          'This leave type needs a supporting document, which cannot be attached when recording leave yet.',
      });
      return;
    }

    mutate(
      {
        employeeId: values.employeeId,
        leaveTypeId: values.leaveTypeId,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason || undefined,
        coverageEmployeeId: values.coverageEmployeeId || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(result.message ?? 'Leave recorded and approved');
          handleClose();
        },
        onError: (err: unknown) => {
          toast.error(extractError(err, 'Could not record this leave'));
        },
      },
    );
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Leave for an Employee"
      description="Record leave on someone's behalf. It is approved straight away and comes off their balance."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Recording..." onClick={handleSubmit(onSubmit)}>
            Record Leave
          </Button>
        </div>
      }
    >
      <Controller
        name="employeeId"
        control={control}
        rules={{ required: 'Please select an employee' }}
        render={({ field }) => (
          <SearchSelect
            label="Employee"
            placeholder="Select employee"
            options={employeeOptions}
            value={field.value}
            onChange={field.onChange}
            error={errors.employeeId?.message}
          />
        )}
      />

      <Controller
        name="leaveTypeId"
        control={control}
        rules={{ required: 'Please select a leave type' }}
        render={({ field }) => (
          <SearchSelect
            label="Leave Type"
            placeholder="Select leave type"
            options={leaveTypes.map((t) => ({
              value: t.id,
              label: t.name,
              sublabel: t.requiresDocument ? 'Needs a supporting document' : undefined,
            }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.leaveTypeId?.message}
          />
        )}
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

      {selectedBalance && (
        <LeaveBalanceBar
          balance={selectedBalance}
          overBy={isOverBalance ? workingDays - selectedBalance.remaining : 0}
        />
      )}

      {workingDays > 0 && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${isOverBalance ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}
        >
          <p
            className={isOverBalance ? 'text-orange-700 font-medium' : 'text-blue-700 font-medium'}
          >
            This leave covers {workingDays} working {workingDays === 1 ? 'day' : 'days'}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('reason')}
          placeholder="Add a note about this leave"
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

      <Controller
        name="coverageEmployeeId"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Cover Person (optional)"
            placeholder="Select a colleague"
            options={coverOptions}
            value={field.value ?? ''}
            onChange={field.onChange}
          />
        )}
      />
    </SidePanel>
  );
}
