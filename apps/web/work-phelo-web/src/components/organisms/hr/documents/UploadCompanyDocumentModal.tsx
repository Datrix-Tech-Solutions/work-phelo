'use client';

import { DatePicker } from '@/components/atoms/DatePicker';
import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DocumentFileDropzone } from '@/components/molecules/hr/documents/DocumentFileDropzone';
import { DOCUMENT_TYPE_LABELS } from './types';
import {
  DriverLicenceFields,
  emptyLicenceDetails,
  licenceDetailsError,
} from '@/components/molecules/hr/documents/DriverLicenceFields';
import type { DocumentType, DriverLicenceDetails } from '@/types/hr';

const TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value: value as DocumentType,
  label,
}));

export interface UploadCompanyDocumentInput {
  file: File;
  type: DocumentType;
  customType?: string;
  expiresAt?: string;
  /** Set for a driver's licence: its details are saved alongside the image. */
  licence?: DriverLicenceDetails;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (input: UploadCompanyDocumentInput) => void;
  isUploading?: boolean;
  /** Limits the categories on offer, e.g. employees may only add a driver's licence. */
  onlyTypes?: DocumentType[];
}

export function UploadCompanyDocumentModal({
  isOpen,
  onClose,
  onUpload,
  isUploading,
  onlyTypes,
}: Props) {
  const typeOptions = onlyTypes
    ? TYPE_OPTIONS.filter((option) => onlyTypes.includes(option.value))
    : TYPE_OPTIONS;
  const defaultType: DocumentType = typeOptions[0]?.value ?? 'CONTRACT';
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>(defaultType);
  const [customType, setCustomType] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [licence, setLicence] = useState<DriverLicenceDetails>(emptyLicenceDetails);

  const reset = () => {
    setFile(null);
    setType(defaultType);
    setCustomType('');
    setExpiresAt('');
    setLicence(emptyLicenceDetails());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isLicence = type === 'DRIVER_LICENCE';
  const isValid =
    Boolean(file) &&
    (type !== 'OTHER' || customType.trim().length > 0) &&
    (!isLicence || licenceDetailsError(licence) === null);

  const handleSubmit = () => {
    if (!file || !isValid) return;
    onUpload({
      file,
      type,
      customType: type === 'OTHER' ? customType.trim() : undefined,
      expiresAt: isLicence ? undefined : expiresAt || undefined,
      ...(isLicence
        ? { licence: { ...licence, licenceNumber: licence.licenceNumber.trim() } }
        : {}),
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
          options={typeOptions}
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

        {isLicence ? (
          <DriverLicenceFields value={licence} onChange={setLicence} />
        ) : (
          <div>
            <DatePicker label="Expires on (optional)" value={expiresAt} onChange={setExpiresAt} />
          </div>
        )}
      </div>
    </Modal>
  );
}
