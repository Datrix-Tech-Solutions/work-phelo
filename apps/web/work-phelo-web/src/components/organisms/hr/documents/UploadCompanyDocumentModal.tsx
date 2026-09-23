'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DocumentFileDropzone } from '@/components/molecules/hr/documents/DocumentFileDropzone';
import { DOCUMENT_TYPE_LABELS } from './types';
import type { DocumentType } from '@/types/hr';

const TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value: value as DocumentType,
  label,
}));

export interface UploadCompanyDocumentInput {
  file: File;
  type: DocumentType;
  customType?: string;
  expiresAt?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (input: UploadCompanyDocumentInput) => void;
  isUploading?: boolean;
}

export function UploadCompanyDocumentModal({ isOpen, onClose, onUpload, isUploading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>('CONTRACT');
  const [customType, setCustomType] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const reset = () => {
    setFile(null);
    setType('CONTRACT');
    setCustomType('');
    setExpiresAt('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = Boolean(file) && (type !== 'OTHER' || customType.trim().length > 0);

  const handleSubmit = () => {
    if (!file || !isValid) return;
    onUpload({
      file,
      type,
      customType: type === 'OTHER' ? customType.trim() : undefined,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload to Company Documents"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!isValid} isLoading={isUploading} onClick={handleSubmit}>
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-4">
        <DocumentFileDropzone file={file} onFileChange={setFile} />

        <SearchSelect
          label="Document type"
          placeholder="Select document type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(value) => setType(value as DocumentType)}
          clearable={false}
        />

        {type === 'OTHER' && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Specify type</label>
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="e.g. Reference Letter"
              className={inputClass()}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            Expires on (optional)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputClass()}
          />
        </div>
      </div>
    </Modal>
  );
}
