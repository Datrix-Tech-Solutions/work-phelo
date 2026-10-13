'use client';

import { useMemo, useState } from 'react';
import { DocumentManagerPanel } from '@/components/organisms/hr/documents/DocumentManagerPanel';
import { UploadCompanyDocumentModal } from '@/components/organisms/hr/documents/UploadCompanyDocumentModal';
import { DriverLicenceDetails } from '@/components/molecules/hr/documents/DriverLicenceDetails';
import { useDriverLicence, useSaveDriverLicence } from '@/hooks/hr/useDriverLicence';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import {
  DOCUMENT_TYPE_LABELS,
  inferFileKind,
  type MyDocument,
} from '@/components/organisms/hr/documents/types';
import {
  useEmployeeDocuments,
  useUploadEmployeeDocument,
  useDeleteEmployeeDocument,
} from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { Employee, EmployeeDocument } from '@/types/hr';

function fromEmployeeDocument(doc: EmployeeDocument): MyDocument {
  return {
    id: doc.id,
    name: doc.name,
    fileKind: inferFileKind(doc.mimeType),
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.createdAt,
    uploadedBy: doc.uploadedBy,
    category:
      doc.type === 'OTHER' && doc.customType ? doc.customType : DOCUMENT_TYPE_LABELS[doc.type],
    previewUrl: doc.url,
    type: doc.type,
  };
}

interface Props {
  employee: Employee;
}

// HR uploads this employee's company documents (contract, offer letter, etc.)
// from here. The employee sees the same documents, read-only, from their own
// profile page (see MyDocumentsContent).
export function EmployeeDocumentsTab({ employee }: Props) {
  const toast = useToast();
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const { data: documentsRaw, isLoading } = useEmployeeDocuments(employee.id);
  const { mutate: uploadDocument, isPending: isUploading } = useUploadEmployeeDocument(employee.id);
  const { mutate: deleteDocument } = useDeleteEmployeeDocument(employee.id);
  const { data: licenceView } = useDriverLicence(employee.id);
  const { mutate: saveLicence, isPending: isSavingLicence } = useSaveDriverLicence(employee.id);

  const documents = useMemo(() => (documentsRaw ?? []).map(fromEmployeeDocument), [documentsRaw]);

  const handleDelete = (doc: MyDocument) => {
    deleteDocument(doc.id, {
      onSuccess: () => toast.success('Document deleted'),
      onError: (err) => toast.error(extractError(err, 'Failed to delete document')),
    });
  };

  return (
    <>
      <DocumentManagerPanel
        documents={documents}
        isLoading={isLoading}
        allowUpload
        allowDelete
        onDelete={handleDelete}
        renderDetails={(doc) =>
          doc.type === 'DRIVER_LICENCE' ? <DriverLicenceDetails scope={employee.id} /> : null
        }
        renderUploadModal={({ isOpen, onClose }) => (
          <UploadCompanyDocumentModal
            isOpen={isOpen}
            onClose={onClose}
            isUploading={isUploading || isSavingLicence}
            onUpload={(input) => {
              // A driver's licence is its image plus its details, saved together.
              if (input.type === 'DRIVER_LICENCE' && input.licence) {
                saveLicence(
                  { file: input.file, details: input.licence, exists: !!licenceView?.licence },
                  {
                    onSuccess: () => {
                      onClose();
                      setUploadSuccess(true);
                    },
                    onError: (err) =>
                      toast.error(extractError(err, "Failed to save the driver's licence")),
                  },
                );
                return;
              }
              uploadDocument(input, {
                onSuccess: () => {
                  onClose();
                  setUploadSuccess(true);
                },
                onError: (err) => toast.error(extractError(err, 'Failed to upload document')),
              });
            }}
          />
        )}
      />

      <SuccessModal
        isOpen={uploadSuccess}
        onClose={() => setUploadSuccess(false)}
        title="Document Uploaded!"
        message={`Document added to ${employee.firstName} ${employee.lastName}'s Company Documents.`}
      />
    </>
  );
}
