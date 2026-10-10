'use client';

import { ChangeEvent, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface Props {
  isOpen: boolean;
  /** What is being reversed, e.g. "PAY26-00001". */
  subject: string;
  isPending: boolean;
  onConfirm: (input: { reversalDate: string; reason: string }) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Asks when and why a posted entry is being reversed. Both the entry and its reversal stay in
 *  the books; the reversal can be voided later to put the entry back as posted. */
export function ReverseEntryModal({ isOpen, subject, isPending, onConfirm, onClose }: Props) {
  const [reversalDate, setReversalDate] = useState(today);
  const [reason, setReason] = useState('');

  // Start fresh each time the modal opens again.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setReversalDate(today());
      setReason('');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reverse Entry"
      description={`Posts a linked reversal of ${subject} that cancels its effect on the books. The original stays on record and is not edited.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingText="Reversing…"
            disabled={!reversalDate || !reason.trim()}
            onClick={() => onConfirm({ reversalDate, reason: reason.trim() })}
          >
            Reverse
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Reversal Date"
          type="date"
          value={reversalDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setReversalDate(e.target.value)}
        />
        <Input
          label="Reason"
          type="textarea"
          rows={3}
          value={reason}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          placeholder="e.g. Paid the wrong supplier"
        />
      </div>
    </Modal>
  );
}
