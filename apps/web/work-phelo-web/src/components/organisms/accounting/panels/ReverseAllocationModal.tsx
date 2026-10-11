'use client';

import { ChangeEvent, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface Props {
  isOpen: boolean;
  /** What the amount was applied to, e.g. "INV26-00001". */
  subject: string;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Asks why an allocation is being reversed. The amount goes back onto the invoice or bill as
 *  outstanding and the receipt or payment is free to be applied again. */
export function ReverseAllocationModal({ isOpen, subject, isPending, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');

  // Start empty each time the modal opens again.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setReason('');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reverse Allocation"
      description={`The amount applied to ${subject} goes back to outstanding, and can be applied again.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingText="Reversing…"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Reverse
          </Button>
        </div>
      }
    >
      <Input
        label="Reason"
        type="textarea"
        rows={3}
        value={reason}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
        placeholder="e.g. Applied to the wrong invoice"
      />
    </Modal>
  );
}
