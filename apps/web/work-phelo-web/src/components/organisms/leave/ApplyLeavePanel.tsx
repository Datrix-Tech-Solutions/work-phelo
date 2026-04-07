'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { CreateLeaveRequestDto, LeaveBalance, LeaveType, PublicHoliday } from '@/types/leave';

interface ApplyLeavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  balances: LeaveBalance[];
}

type FormValues = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentationUrl: string;
};

/* ── Working days calculator ── */
function calcWorkingDays(start: string, end: string, holidays: PublicHoliday[]): number {
  if (!start || !end || end < start) return 0;

  const holidaySet = new Set<string>();
  holidays.forEach((h) => {
    const cur = new Date(h.startDate);
    const last = new Date(h.endDate);
    while (cur <= last) {
      holidaySet.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  });

  let count = 0;
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(cur.toISOString().slice(0, 10))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function ApplyLeavePanel({ isOpen, onClose, tenantSlug, balances }: ApplyLeavePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types', tenantSlug],
    queryFn: () => api.get(`/${tenantSlug}/leave-types`).then((r) => r.data),
    enabled: isOpen,
  });

  const { data: holidays = [] } = useQuery<PublicHoliday[]>({
    queryKey: ['public-holidays', tenantSlug],
    queryFn: () => api.get(`/${tenantSlug}/public-holidays`).then((r) => r.data),
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      leaveTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
      documentationUrl: '',
    },
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const leaveTypeId = useWatch({ control, name: 'leaveTypeId' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  const selectedType = useMemo(
    () => leaveTypes.find((t) => t.id === leaveTypeId),
    [leaveTypes, leaveTypeId],
  );

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId),
    [balances, leaveTypeId],
  );

  const workingDays = useMemo(
    () => calcWorkingDays(startDate, endDate, holidays),
    [startDate, endDate, holidays],
  );

  const isOverBalance =
    selectedBalance != null && workingDays > 0 && workingDays > selectedBalance.remaining;

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateLeaveRequestDto) => api.post(`/${tenantSlug}/leave/request`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', tenantSlug] });
      toast.success('Leave request submitted');
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
    if (!values.leaveTypeId) return;
    mutate({
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate,
      endDate: values.endDate,
      reason: values.reason || undefined,
      documentationUrl: values.documentationUrl || undefined,
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      description="Submit a leave request for your manager's approval."
      width="w-[500px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Submitting..."
            onClick={handleSubmit(onSubmit)}
          >
            Submit Request
          </Button>
        </div>
      }
    >
      {/* Leave Type */}
      <Controller
        name="leaveTypeId"
        control={control}
        rules={{ required: 'Please select a leave type' }}
        render={({ field }) => (
          <SearchSelect
            label="Leave Type"
            placeholder="Select leave type"
            options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.leaveTypeId?.message}
          />
        )}
      />

      {/* Dates */}
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
              disablePast
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
              disablePast
            />
          )}
        />
      </div>

      {/* Working days summary */}
      {workingDays > 0 && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${isOverBalance ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}
        >
          <p
            className={isOverBalance ? 'text-orange-700 font-medium' : 'text-blue-700 font-medium'}
          >
            This request covers {workingDays} working {workingDays === 1 ? 'day' : 'days'}.
          </p>
          {isOverBalance && selectedBalance && (
            <p className="text-orange-600 mt-0.5">
              You only have {selectedBalance.remaining}{' '}
              {selectedBalance.remaining === 1 ? 'day' : 'days'} available for this leave type. You
              are requesting {workingDays} days.
            </p>
          )}
        </div>
      )}

      {/* Reason / Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('reason')}
          placeholder="Add a note for your manager"
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

      {/* Documentation — conditional on selected leave type */}
      {selectedType?.requiresDocumentation && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">
            Supporting Document
            <span className="ml-1.5 text-xs font-normal text-orange-500">Required</span>
          </label>
          {selectedType.documentationDescription && (
            <p className="text-xs text-gray-500">{selectedType.documentationDescription}</p>
          )}
          <input
            type="text"
            {...register('documentationUrl', {
              required: selectedType.requiresDocumentation
                ? 'Documentation is required for this leave type'
                : false,
            })}
            placeholder="Paste document URL"
            className={inputClass(errors.documentationUrl?.message)}
          />
          {errors.documentationUrl && (
            <p className="text-xs text-red-500">{errors.documentationUrl.message}</p>
          )}
        </div>
      )}
    </SidePanel>
  );
}
