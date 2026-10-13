'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface Props {
  isOpen: boolean;
  /** What is being rejected, e.g. "Invoice INV26-00001". */
  subject: string;
  /** False when the form to redo it can't be opened (e.g. its transaction type is unknown). */
  canRedo: boolean;
  isDeleting: boolean;
  onRedo: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** What to do with a draft that isn't right: redo it in its form, or delete it. A posted entry
 *  never gets here — it stays as it is. */
export function DraftChoiceModal({
  isOpen,
  subject,
  canRedo,
  isDeleting,
  onRedo,
  onDelete,
  onClose,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleClose = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reject Draft"
      description={
        confirming
          ? `${subject} will be deleted for good. This can't be undone.`
          : `What should happen to ${subject}?`
      }
      footer={
        confirming ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={isDeleting}>
              Go Back
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={onDelete}
            >
              Yes, Delete
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      {!confirming && (
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => {
              handleClose();
              onRedo();
            }}
            className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">Redo</span>
              <span className="text-xs text-gray-500">
                {canRedo
                  ? 'Open the form with its details to change anything, then submit it again. The old draft is replaced.'
                  : "The form can't be opened for this draft — delete it and enter it again."}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">Delete</span>
              <span className="text-xs text-gray-500">Remove the draft for good.</span>
            </span>
          </button>
        </div>
      )}
    </Modal>
  );
}
