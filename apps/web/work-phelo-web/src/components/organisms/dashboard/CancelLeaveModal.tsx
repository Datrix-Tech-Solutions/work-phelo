'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { useCancelLeaveRequest } from '@/hooks/hr/useLeave';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import type { LeaveRequest } from '@/types/hr';

interface CancelLeaveModalProps {
  /** The pending request being withdrawn; the modal is open while this is set. */
  request: LeaveRequest | null;
  onClose: () => void;
}

export function CancelLeaveModal({ request, onClose }: CancelLeaveModalProps) {
  const toast = useToast();
  const { mutate: cancelRequest, isPending } = useCancelLeaveRequest();

  const handleConfirm = () => {
    if (!request) return;
    cancelRequest(request.id, {
      onSuccess: () => {
        toast.success('Leave request cancelled');
        onClose();
      },
      onError: (err) => toast.error(extractError(err, 'Something went wrong')),
    });
  };

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="Cancel Leave Request"
      description={`Cancel your ${request?.leaveTypeName ?? 'leave'} request from ${request ? formatDate(request.startDate) : ''} to ${request ? formatDate(request.endDate) : ''}? This cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Keep Request
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingText="Cancelling..."
            onClick={handleConfirm}
          >
            Cancel Request
          </Button>
        </div>
      }
    />
  );
}
