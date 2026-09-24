'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';

interface BulkUploadImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export function BulkUploadImportDialog({
  isOpen,
  onClose,
  title,
  description,
}: BulkUploadImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleClose = () => {
    setFile(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={description}
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled>
            Download Template
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button disabled>Import</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <FileUpload
          label="Filled template"
          accept=".xlsx"
          value={file}
          onChange={setFile}
          hint="Only .xlsx files exported from the template above are supported."
        />
      </div>
    </Modal>
  );
}
