'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  /** What will happen, in a sentence or two. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions use the red button. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** The app's confirmation pop-up, used instead of the browser's own confirm dialog. */
export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && <div className="mt-3">{children}</div>}
    </Modal>
  );
}
