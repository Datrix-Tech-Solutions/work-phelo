'use client';

import { useState } from 'react';
import { Employee } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '../shared/SidePanel';
import { Modal } from '../shared/Modal';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ResignationPayload | null>(null);
  const { data: resignation } = useResignationRecord(employee.id);
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

  const onSubmit = (data: ResignationForm) => {
    const payload: ResignationPayload = {
      lastWorkingDate: data.lastWorkingDate,
      ...(data.reason && { reason: data.reason }),
      ...(data.additionalNotes && { additionalNotes: data.additionalNotes }),
    };
    setPendingPayload(payload);
    setConfirmOpen(true);
  };

  const handleConfirmResign = () => {
    if (!pendingPayload) return;
    resignEmployee(pendingPayload, {
      onSuccess: () => {
        toast.success('Resignation submitted successfully');
        reset();
        setConfirmOpen(false);
        setPendingPayload(null);
        onClose();
      },
      onError: (err) => {
        toast.error(extractError(err, 'Failed to submit resignation'));
        setConfirmOpen(false);
        setPendingPayload(null);
      },
    });
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

  return (
    <>
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
                Submit
              </Button>
            </div>
          )
        }
      >
        {hasPendingResignation ? (
          <div className="flex flex-col gap-4">
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
                    disablePast
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

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Resignation"
        description="Are you sure you want to submit your resignation? This action cannot be undone once accepted by HR."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              loadingText="Submitting…"
              onClick={handleConfirmResign}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              Yes, Resign
            </Button>
          </>
        }
      />
    </>
  );
}
