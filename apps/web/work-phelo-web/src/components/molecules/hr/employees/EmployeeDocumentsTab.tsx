'use client';

import { useMemo, useState } from 'react';
import { DocumentManagerPanel } from '@/components/organisms/hr/documents/DocumentManagerPanel';
import { UploadCompanyDocumentModal } from '@/components/organisms/hr/documents/UploadCompanyDocumentModal';
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
        renderUploadModal={({ isOpen, onClose }) => (
          <UploadCompanyDocumentModal
            isOpen={isOpen}
            onClose={onClose}
            isUploading={isUploading}
            onUpload={(input) => {
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
