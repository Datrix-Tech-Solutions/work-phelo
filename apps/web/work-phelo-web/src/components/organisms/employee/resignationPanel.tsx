'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '../shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useResignationRecord,
  useResignEmployee,
  useWithdrawResignation,
  useDismissResignation,
} from '@/hooks/hr/useEmployees';
import { useCompanyPoliciesSettings } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { ResignationPayload, ResignationReason } from '@/types/hr';

interface ResignationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  isHrView?: boolean;
  onAccept?: () => void;
}

interface ResignationForm {
  lastWorkingDate: string;
  reason: ResignationReason;
  additionalNotes: string;
}

const REASON_OPTIONS = [
  { value: 'PERSONAL_REASONS', label: 'Personal Reasons' },
  { value: 'BETTER_OPPORTUNITY', label: 'Better Opportunity' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'FURTHER_EDUCATION', label: 'Further Education' },
  { value: 'HEALTH_REASONS', label: 'Health Reasons' },
  { value: 'OTHER', label: 'Other' },
];

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REASON_OPTIONS.map((o) => [o.value, o.label]),
);

const NOTIFY_DELAY_MS = 30 * 60 * 1000;

function useWithdrawalCountdown(submittedAt: string) {
  const getRemaining = () =>
    Math.max(0, NOTIFY_DELAY_MS - (Date.now() - new Date(submittedAt).getTime()));

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (remaining === 0) return;
    const id = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired = remaining === 0;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { expired, formatted };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ResignationPanel({
  isOpen,
  onClose,
  employee,
  isHrView,
  onAccept,
}: ResignationPanelProps) {
  const toast = useToast();
  const { data: policiesSettings } = useCompanyPoliciesSettings();
  const { data: resignation } = useResignationRecord(employee.id);

  const minLastWorkingDate = (() => {
    const noticeDays = policiesSettings?.resignationNoticePeriodDays ?? 0;
    const d = new Date();
    d.setDate(d.getDate() + noticeDays);
    return d.toISOString().split('T')[0];
  })();
  const { mutate: resignEmployee, isPending: isSubmitting } = useResignEmployee(employee.id);
  const { mutate: withdrawResignation, isPending: isWithdrawing } = useWithdrawResignation(
    employee.id,
  );
  const { mutate: dismissResignation, isPending: isDismissing } = useDismissResignation(
    employee.id,
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResignationForm>();

  // Countdown-before-submit state
  const [countdownPayload, setCountdownPayload] = useState<ResignationPayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(NOTIFY_DELAY_MS);

  useEffect(() => {
    if (!countdownPayload) return;
    const start = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, NOTIFY_DELAY_MS - (Date.now() - start));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(id);
        resignEmployee(countdownPayload, {
          onSuccess: () => {
            toast.success('Resignation submitted successfully');
            reset();
            setCountdownPayload(null);
            onClose();
          },
          onError: (err) => {
            toast.error(extractError(err, 'Failed to submit resignation'));
            setCountdownPayload(null);
          },
        });
      }
    }, 1000);
    return () => clearInterval(id);
    // resignEmployee, toast, reset, onClose are all stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownPayload]);

  const onSubmit = (data: ResignationForm) => {
    const payload: ResignationPayload = {
      lastWorkingDate: data.lastWorkingDate,
      ...(data.reason && { reason: data.reason }),
      ...(data.additionalNotes && { additionalNotes: data.additionalNotes }),
    };
    setTimeLeft(NOTIFY_DELAY_MS);
    setCountdownPayload(payload);
  };

  const cancelCountdown = () => {
    setCountdownPayload(null);
    setTimeLeft(NOTIFY_DELAY_MS);
  };

  const handleWithdraw = () => {
    withdrawResignation(undefined, {
      onSuccess: () => {
        toast.success('Resignation withdrawn successfully');
        onClose();
      },
      onError: (err) => toast.error(extractError(err, 'Failed to withdraw resignation')),
    });
  };

  const hasPendingResignation = resignation?.status === 'PENDING';
  const countdown = useWithdrawalCountdown(resignation?.submittedAt ?? new Date(0).toISOString());

  const countdownMinutes = Math.floor(timeLeft / 60000);
  const countdownSeconds = Math.floor((timeLeft % 60000) / 1000);
  const countdownFormatted = `${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')}`;

  // Countdown-before-submit view
  if (countdownPayload) {
    return (
      <SidePanel
        isOpen={isOpen}
        onClose={() => {
          cancelCountdown();
          onClose();
        }}
        title="Resignation"
        description={`${employee.firstName} ${employee.lastName}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
              }}
              disabled={isSubmitting}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={cancelCountdown}
              disabled={isSubmitting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Withdraw
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Timer ring */}
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-32 h-32 rounded-full border-4 border-amber-200 bg-amber-50 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold text-amber-700 tracking-tight">
                {countdownFormatted}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-700">Submitting resignation in…</p>
          </div>

          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1">
            <p className="text-sm text-amber-800 font-medium">
              Your resignation has not been sent yet.
            </p>
            <p className="text-xs text-amber-700">
              Click <span className="font-semibold">Withdraw</span> to abort before the timer
              expires. Once submitted, you will have a window to withdraw before HR is notified.
            </p>
          </div>

          {/* Resignation details summary */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Resignation Details
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Last Working Date</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(countdownPayload.lastWorkingDate)}
                </span>
              </div>
              {countdownPayload.reason && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Reason</span>
                  <span className="text-sm font-medium text-gray-900">
                    {REASON_LABELS[countdownPayload.reason] ?? countdownPayload.reason}
                  </span>
                </div>
              )}
              {countdownPayload.additionalNotes && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Additional Notes</span>
                  <span className="text-sm text-gray-700">{countdownPayload.additionalNotes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Resignation"
      description={`${employee.firstName} ${employee.lastName}`}
      footer={
        hasPendingResignation ? (
          isHrView ? (
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  dismissResignation(undefined, {
                    onSuccess: () => {
                      toast.success('Resignation rejected');
                      onClose();
                    },
                    onError: (err) =>
                      toast.error(extractError(err, 'Failed to reject resignation')),
                  });
                }}
                disabled={isDismissing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  onAccept?.();
                }}
                disabled={isDismissing}
              >
                Accept
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isWithdrawing}>
                Close
              </Button>
              <Button
                isLoading={isWithdrawing}
                loadingText="Withdrawing…"
                onClick={handleWithdraw}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                Withdraw Resignation
              </Button>
            </div>
          )
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              loadingText="Submitting…"
              onClick={handleSubmit(onSubmit)}
            >
              Resign
            </Button>
          </div>
        )
      }
    >
      {hasPendingResignation ? (
        <div className="flex flex-col gap-4">
          {/* HR notification countdown — employee only */}
          {!isHrView && (
            <div
              className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                countdown.expired
                  ? 'bg-gray-50 border border-gray-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <span className="text-lg">{countdown.expired ? '✓' : '⏱'}</span>
              <div className="flex flex-col gap-0.5">
                {countdown.expired ? (
                  <p className="text-sm font-semibold text-gray-700">HR has been notified</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-amber-800">
                      HR notified in{' '}
                      <span className="font-mono tracking-tight">{countdown.formatted}</span>
                    </p>
                    <p className="text-xs text-amber-700">
                      You can still withdraw your resignation before the timer expires.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Resignation Details
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Status</span>
              <span className="text-sm font-medium text-amber-600">Pending</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Last Working Date</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(resignation.lastWorkingDate)}
              </span>
            </div>
            {resignation.reason && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Reason</span>
                <span className="text-sm font-medium text-gray-900">
                  {REASON_LABELS[resignation.reason] ?? resignation.reason}
                </span>
              </div>
            )}
            {resignation.additionalNotes && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Additional Notes</span>
                <span className="text-sm text-gray-700">{resignation.additionalNotes}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Submitted</span>
              <span className="text-sm text-gray-700">{formatDate(resignation.submittedAt)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Resignation Details
          </p>
          <div className="flex flex-col gap-4">
            <Controller
              name="lastWorkingDate"
              control={control}
              rules={{ required: 'Last working date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Last Working Date"
                  value={field.value}
                  onChange={field.onChange}
                  minDate={minLastWorkingDate}
                  error={errors.lastWorkingDate?.message}
                />
              )}
            />

            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Reason for Resignation"
                  placeholder="Select reason"
                  value={field.value}
                  onChange={field.onChange}
                  options={REASON_OPTIONS}
                  error={errors.reason?.message}
                />
              )}
            />

            <FormField
              label="Additional Notes"
              registration={register('additionalNotes')}
              error={errors.additionalNotes}
              type="textarea"
              rows={5}
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>
      )}
    </SidePanel>
  );
}
