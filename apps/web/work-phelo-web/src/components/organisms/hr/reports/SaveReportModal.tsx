'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';

interface SaveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSaving: boolean;
  error?: string;
  initialName?: string;
  initialDescription?: string;
  onSave: (values: { name: string; description?: string }) => void;
}

export function SaveReportModal({
  isOpen,
  onClose,
  isSaving,
  error,
  initialName = '',
  initialDescription = '',
  onSave,
}: SaveReportModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setDescription(initialDescription);
    // Reset on open only, so typing isn't overwritten by a parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const trimmed = name.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save report"
      description="Saved reports are shared with everyone who can open Reports."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            isLoading={isSaving}
            disabled={trimmed.length < 2}
            onClick={() => onSave({ name: trimmed, description: description.trim() || undefined })}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          maxLength={120}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <Input
          type="textarea"
          label="Description (optional)"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
