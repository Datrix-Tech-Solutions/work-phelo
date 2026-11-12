'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface RejectModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** Asks why something is being rejected: the reason is kept with the record. */
export function RejectModal({
  isOpen,
  title,
  description,
  isLoading,
  onClose,
  onConfirm,
}: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);

  const close = () => {
    setReason('');
    setShowError(false);
    onClose();
  };
  const confirm = () => {
    if (!reason.trim()) {
      setShowError(true);
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            isLoading={isLoading}
            loadingText="Rejecting..."
          >
            Reject
          </Button>
        </div>
      }
    >
      <div className="mt-2">
        <span className="mb-1 block text-sm font-semibold text-gray-900">Reason</span>
        <Input
          aria-label="Reason"
          placeholder="Why is this being rejected?"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={showError && !reason.trim() ? 'A reason is required' : undefined}
        />
      </div>
    </Modal>
  );
}
