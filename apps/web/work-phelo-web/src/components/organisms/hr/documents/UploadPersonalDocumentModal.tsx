'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DocumentFileDropzone } from '@/components/molecules/hr/documents/DocumentFileDropzone';
import {
  DriverLicenceFields,
  emptyLicenceDetails,
  licenceDetailsError,
} from '@/components/molecules/hr/documents/DriverLicenceFields';
import type { DriverLicenceDetails } from '@/types/hr';
import { DRIVER_LICENCE_CATEGORY, PERSONAL_DOCUMENT_CATEGORIES } from './types';

// The driver's licence sits just before "Other", which stays last.
const CATEGORY_OPTIONS = [
  DRIVER_LICENCE_CATEGORY,
  ...PERSONAL_DOCUMENT_CATEGORIES.filter((label) => label !== 'Other'),
  'Other',
].map((label) => ({ value: label, label }));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** `licence` is set when the category is Driver's Licence. */
  onUpload: (input: { file: File; category: string; licence?: DriverLicenceDetails }) => void;
  isUploading?: boolean;
}

export function UploadPersonalDocumentModal({ isOpen, onClose, onUpload, isUploading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [licence, setLicence] = useState<DriverLicenceDetails>(emptyLicenceDetails);

  const reset = () => {
    setFile(null);
    setCategory('');
    setCustomCategory('');
    setLicence(emptyLicenceDetails());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isOther = category === 'Other';
  const isLicence = category === DRIVER_LICENCE_CATEGORY;
  const isValid =
    Boolean(file) &&
    Boolean(category) &&
    (!isOther || Boolean(customCategory.trim())) &&
    (!isLicence || licenceDetailsError(licence) === null);

  const handleSubmit = () => {
    if (!file || !isValid) return;
    onUpload({
      file,
      category: isOther ? customCategory.trim() : category,
      ...(isLicence
        ? { licence: { ...licence, licenceNumber: licence.licenceNumber.trim() } }
        : {}),
    });
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

        {isLicence && <DriverLicenceFields value={licence} onChange={setLicence} />}
      </div>
    </Modal>
  );
}
