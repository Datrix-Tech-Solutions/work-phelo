'use client';

import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';

interface SeedHierarchyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** Confirmation dialog for seeding the standard classification/group hierarchy from the
 *  Chart of Accounts page. Non-destructive — existing records are always preserved. */
export function SeedHierarchyDialog({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: SeedHierarchyDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Seed Standard Account Hierarchy"
      description="This safely adds missing standard classifications and account groups. Existing tenant hierarchy records are preserved and will not be overwritten."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={isPending} loadingText="Seeding…">
            Seed Hierarchy
          </Button>
        </>
      }
    />
  );
}
