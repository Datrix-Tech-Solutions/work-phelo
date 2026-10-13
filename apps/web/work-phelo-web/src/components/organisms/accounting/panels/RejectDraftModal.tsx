'use client';

import { ChangeEvent, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface Props {
  isOpen: boolean;
  /** What is being rejected, e.g. "Invoice INV26-00001". */
  subject: string;
  isRejecting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  /** Defaults to "Reject Draft". */
  title?: string;
  /** Defaults to the line about a draft that is never posted. */
  description?: string;
}

/** Turning a draft down. The reason is kept on the record and shown to whoever raised it. */
export function RejectDraftModal({
  isOpen,
  subject,
  isRejecting,
  onConfirm,
  onClose,
  title = 'Reject Draft',
  description,
}: Props) {
  const [reason, setReason] = useState('');

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
        `${subject} will never be posted. It keeps its record, and the reason is shown to whoever raised it.`
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isRejecting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            isLoading={isRejecting}
            loadingText="Rejecting…"
            onClick={() => onConfirm(reason.trim())}
          >
            Reject
          </Button>
        </div>
      }
    >
      <Input
        label="Reason"
        type="textarea"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
        placeholder="e.g. Wrong client — raise it again for Dell Computers"
      />
    </Modal>
  );
}
