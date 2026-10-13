'use client';

import { ChangeEvent, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface Props {
  isOpen: boolean;
  /** What is being voided, e.g. "Invoice INV26-00001". */
  subject: string;
  isPending: boolean;
  /** Wording for taking a reversal back instead of voiding the entry itself. */
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Asks why a posted entry is being voided. It leaves the books and goes to the archive, from
 *  where it can be restored while its period is open. */
export function VoidEntryModal({
  isOpen,
  subject,
  isPending,
  title = 'Void Entry',
  description,
  confirmLabel = 'Void',
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState('');

  // Start empty each time the modal opens again.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setReason('');
  }

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={
        description ??
        `${subject} will come out of the books and every balance and report. It moves to the archive, where it can be restored while its period is open.`
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingText="Voiding…"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
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
        placeholder="e.g. Posted to the wrong account"
      />
    </Modal>
  );
}
