'use client';

import { useState } from 'react';
import { extractError } from '@/lib/extractError';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { useLeaveBalances, useReviewLeaveRequest } from '@/hooks/useLeave';
import { LeaveRequest, LeaveRequestStatus } from '@/types/hr';

interface LeaveRequestDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  request: LeaveRequest | null;
}

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function LeaveRequestDetailPanel({
  isOpen,
  onClose,
  request,
}: LeaveRequestDetailPanelProps) {
  const toast = useToast();
  const [reviewNote, setReviewNote] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  /* ── Employee balance for this leave type ── */
  const { data: employeeBalances = [] } = useLeaveBalances(request?.employeeId, {
    enabled: isOpen && !!request?.employeeId,
  });

  const typeBalance = employeeBalances.find((b) => b.leaveTypeId === request?.leaveTypeId);

  const { mutate: reviewRequest, isPending } = useReviewLeaveRequest();

  const handleConfirm = () => {
    if (!confirmAction || !request) return;
    reviewRequest(
      {
        id: request.id,
        action: confirmAction === 'approve' ? 'APPROVED' : 'REJECTED',
        note: reviewNote || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            confirmAction === 'approve' ? 'Leave request approved' : 'Leave request rejected',
          );
          setConfirmAction(null);
          setReviewNote('');
          onClose();
        },
        onError: (err) => {
          toast.error(extractError(err, 'Something went wrong'));
          setConfirmAction(null);
        },
      },
    );
  };

  if (!request) return null;

  const isPending_ = request.status === 'PENDING';

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={onClose}
        title="Leave Request"
        description={`Submitted by ${request.employeeName}`}
        footer={
          isPending_ ? (
            <div className="flex items-center gap-3">
              <Button
                variant="danger"
                onClick={() => setConfirmAction('reject')}
                disabled={isPending}
              >
                Reject
              </Button>
              <div className="flex-1" />
              <Button onClick={() => setConfirmAction('approve')} isLoading={isPending}>
                Approve
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          )
        }
      >
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[request.status]} label={request.status} />
          {request.reviewedBy && (
            <span className="text-xs text-gray-400">
              by {request.reviewedBy}
              {request.reviewedAt ? ` · ${formatDate(request.reviewedAt)}` : ''}
            </span>
          )}
        </div>

        {/* Request details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
          <DetailRow label="Employee">{request.employeeName}</DetailRow>
          <DetailRow label="Leave Type">{request.leaveTypeName}</DetailRow>
          <DetailRow label="Start Date">{formatDate(request.startDate)}</DetailRow>
          <DetailRow label="End Date">{formatDate(request.endDate)}</DetailRow>
          <DetailRow label="Working Days">
            <span className="font-semibold text-brand">
              {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
            </span>
          </DetailRow>
          <DetailRow label="Date Submitted">{formatDate(request.createdAt)}</DetailRow>
        </div>

        {/* Employee balance for this leave type */}
        {typeBalance && (
          <div className="flex flex-col gap-2 p-4 rounded-2xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {request.employeeName}&apos;s {typeBalance.leaveTypeName} Balance
            </p>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{
                  width: `${typeBalance.entitled > 0 ? Math.min(100, (typeBalance.used / typeBalance.entitled) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                <span className="font-semibold text-gray-900">{typeBalance.remaining}</span>{' '}
                remaining of {typeBalance.entitled}
              </span>
              <span>{typeBalance.used} used</span>
            </div>
            {typeBalance.pending > 0 && (
              <p className="text-xs text-orange-500">
                {typeBalance.pending} day{typeBalance.pending !== 1 ? 's' : ''} in pending requests
              </p>
            )}
            {request.totalDays > typeBalance.remaining && (
              <p className="text-xs text-orange-600 font-medium">
                ⚠ Request exceeds available balance by {request.totalDays - typeBalance.remaining}{' '}
                day{request.totalDays - typeBalance.remaining !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Employee notes */}
        {request.reason && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Employee Notes
            </p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {request.reason}
            </p>
          </div>
        )}

        {/* Documentation */}
        {request.documentationUrl && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Documentation
            </p>
            <a
              href={request.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand underline underline-offset-2 hover:opacity-70 transition-opacity break-all"
            >
              {request.documentationUrl}
            </a>
          </div>
        )}

        {/* Reviewer note — only editable when pending, read-only when already reviewed */}
        {isPending_ ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Note for Employee{' '}
              <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a note visible to the employee..."
              rows={3}
              className={inputClass(undefined, 'resize-none')}
            />
          </div>
        ) : request.reviewNote ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Reviewer Note
            </p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {request.reviewNote}
            </p>
          </div>
        ) : null}
      </SidePanel>

      {/* Approve confirmation */}
      <Modal
        isOpen={confirmAction === 'approve'}
        onClose={() => setConfirmAction(null)}
        title="Approve Leave Request"
        description={`Approve ${request.totalDays} day${request.totalDays !== 1 ? 's' : ''} of ${request.leaveTypeName} for ${request.employeeName}?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Approving..." onClick={handleConfirm}>
              Approve
            </Button>
          </div>
        }
      />

      {/* Reject confirmation */}
      <Modal
        isOpen={confirmAction === 'reject'}
        onClose={() => setConfirmAction(null)}
        title="Reject Leave Request"
        description={`Reject this leave request for ${request.employeeName}?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isPending}
              loadingText="Rejecting..."
              onClick={handleConfirm}
            >
              Reject
            </Button>
          </div>
        }
      />
    </>
  );
}
