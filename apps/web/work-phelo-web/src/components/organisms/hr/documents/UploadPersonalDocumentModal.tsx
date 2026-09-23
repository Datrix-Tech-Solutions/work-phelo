'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DocumentFileDropzone } from '@/components/molecules/hr/documents/DocumentFileDropzone';
import { PERSONAL_DOCUMENT_CATEGORIES } from './types';

const CATEGORY_OPTIONS = PERSONAL_DOCUMENT_CATEGORIES.map((label) => ({
  value: label,
  label,
}));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (input: { file: File; category: string }) => void;
  isUploading?: boolean;
}

export function UploadPersonalDocumentModal({ isOpen, onClose, onUpload, isUploading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  const reset = () => {
    setFile(null);
    setCategory('');
    setCustomCategory('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isOther = category === 'Other';
  const isValid = Boolean(file) && Boolean(category) && (!isOther || customCategory.trim());

  const handleSubmit = () => {
    if (!file || !isValid) return;
    onUpload({ file, category: isOther ? customCategory.trim() : category });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload to Personal Documents"
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
          label="Category"
          placeholder="Select category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
        />

        {isOther && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Specify category</label>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Reference Letter"
              className={inputClass()}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
