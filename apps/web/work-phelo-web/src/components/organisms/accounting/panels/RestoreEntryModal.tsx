'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface Props {
  isOpen: boolean;
  /** What is being restored, e.g. "Receipt ARR-0003". */
  subject: string;
  /** Why it comes back as it was rather than through a form. */
  note?: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirms bringing a voided entry back exactly as it was, for the kinds that have no form to
 *  correct first. It keeps its number and counts in the books again. */
export function RestoreEntryModal({ isOpen, subject, note, isPending, onConfirm, onClose }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore Entry"
      description={`${subject} will go back into the books under its own number and count in balances and reports again.${note ? ` ${note}` : ''}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Restoring…" onClick={onConfirm}>
            Restore
          </Button>
        </div>
      }
    />
  );
}
