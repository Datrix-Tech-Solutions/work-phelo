'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { DocumentFileDropzone } from '@/components/molecules/hr/documents/DocumentFileDropzone';
import {
  DriverLicenceFields,
  emptyLicenceDetails,
  licenceDetailsError,
} from '@/components/molecules/hr/documents/DriverLicenceFields';
import { useSaveDriverLicence, type DriverLicenceScope } from '@/hooks/hr/useDriverLicence';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { DriverLicenceDetails, DriverLicenceView } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scope: DriverLicenceScope;
  current: DriverLicenceView | undefined;
}

export function DriverLicenceModal({ isOpen, onClose, scope, current }: Props) {
  if (!isOpen) return null;
  // Keyed so the form starts from the saved details each time it opens.
  return (
    <LicenceForm
      key={current?.licence?.id ?? 'new'}
      onClose={onClose}
      scope={scope}
      current={current}
    />
  );
}

function LicenceForm({
  onClose,
  scope,
  current,
}: {
  onClose: () => void;
  scope: DriverLicenceScope;
  current: DriverLicenceView | undefined;
}) {
  const toast = useToast();
  const save = useSaveDriverLicence(scope);
  const exists = !!current?.licence;
  const needsImage = !current?.imageOnFile;

  const [file, setFile] = useState<File | null>(null);
  const [details, setDetails] = useState<DriverLicenceDetails>(
    current?.licence
      ? {
          licenceNumber: current.licence.licenceNumber,
          issuedAt: current.licence.issuedAt,
          expiresAt: current.licence.expiresAt,
        }
      : emptyLicenceDetails(),
  );

  const problem =
    licenceDetailsError(details) ??
    (needsImage && !file ? 'Upload an image of the licence.' : null);

  function handleSave() {
    if (problem) return;
    save.mutate(
      { file, details: { ...details, licenceNumber: details.licenceNumber.trim() }, exists },
      {
        onSuccess: () => {
          toast.success(exists ? "Driver's licence updated" : "Driver's licence added");
          onClose();
        },
        onError: (error) => toast.error(extractError(error, "Failed to save the driver's licence")),
      },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={exists ? "Update Driver's Licence" : "Add Driver's Licence"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!!problem} isLoading={save.isPending} onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            {needsImage ? 'Licence image *' : 'Replace the licence image (optional)'}
          </p>
          <DocumentFileDropzone file={file} onFileChange={setFile} />
        </div>
        <DriverLicenceFields value={details} onChange={setDetails} />
        <p className="text-xs text-gray-400">
          Driving yourself on company trips needs an unexpired licence and its image on file.
        </p>
      </div>
    </Modal>
  );
}
