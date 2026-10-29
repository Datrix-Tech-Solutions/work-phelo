'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface DeleteInventoryRecordModalProps {
  /** What is being deleted, e.g. "Category". Shown in the title. */
  kind: string;
  /** The record's name, or null while closed. */
  name: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteInventoryRecordModal({
  kind,
  name,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteInventoryRecordModalProps) {
  return (
    <Modal
      isOpen={name !== null}
      onClose={onClose}
      title={`Delete ${kind}`}
      description={`Are you sure you want to delete "${name}"? This cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            loadingText="Deleting..."
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      }
    />
  );
}
