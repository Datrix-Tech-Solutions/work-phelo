'use client';

import { useMemo, useState } from 'react';
import { DocumentFoldersRail } from '@/components/molecules/hr/documents/DocumentFoldersRail';
import { DocumentManagerPanel } from './DocumentManagerPanel';
import { UploadPersonalDocumentModal } from './UploadPersonalDocumentModal';
import { DriverLicenceDetails } from '@/components/molecules/hr/documents/DriverLicenceDetails';
import { UploadCompanyDocumentModal } from './UploadCompanyDocumentModal';
import { useDriverLicence, useSaveDriverLicence } from '@/hooks/hr/useDriverLicence';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { useMyDocuments, useUploadMyDocument, useDeleteMyDocument } from '@/hooks/useMyDocuments';
import { useMyEmployeeDocuments } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import {
  DOCUMENT_TYPE_LABELS,
  inferFileKind,
  type DocumentFolderKey,
  type MyDocument,
} from './types';
import type { UserDocument } from '@/hooks/useMyDocuments';
import type { DriverLicenceDetails as LicenceDetails, EmployeeDocument } from '@/types/hr';

function fromUserDocument(doc: UserDocument): MyDocument {
  return {
    id: doc.id,
    name: doc.fileName,
    fileKind: inferFileKind(doc.mimeType),
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.createdAt,
    uploadedBy: 'You',
    category: doc.category,
    previewUrl: doc.url,
  };
}

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

// Personal documents are uploaded here, by the employee. Company documents are
// uploaded from the employee's record by HR (see EmployeeDocumentsTab) — this
// view only lets the employee view/download those, not add or remove them.
export function MyDocumentsContent() {
  const [folder, setFolder] = useState<DocumentFolderKey>('personal');
  // Sticky once a document's been selected — closing the preview (or
  // deleting the selected doc) does not re-expand the rail. Only switching
  // folders resets it.
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const toast = useToast();

  const handleFolderSelect = (next: DocumentFolderKey) => {
    setFolder(next);
    setRailCollapsed(false);
  };

  const { data: personalDocsRaw, isLoading: personalLoading } = useMyDocuments();
  const { data: companyDocsRaw, isLoading: companyLoading } = useMyEmployeeDocuments();
  const { mutate: uploadDocument, isPending: isUploading } = useUploadMyDocument();
  const { mutate: deleteDocument } = useDeleteMyDocument();
  const { data: licenceView } = useDriverLicence(null);
  const { mutate: saveLicence, isPending: isSavingLicence } = useSaveDriverLicence(null);

  const personalDocs = useMemo(
    () => (personalDocsRaw ?? []).map(fromUserDocument),
    [personalDocsRaw],
  );
  const companyDocs = useMemo(
    () => (companyDocsRaw ?? []).map(fromEmployeeDocument),
    [companyDocsRaw],
  );

  const counts = { personal: personalDocs.length, company: companyDocs.length };
  const documents = folder === 'personal' ? personalDocs : companyDocs;
  const isLoading = folder === 'personal' ? personalLoading : companyLoading;

  const handleUpload = (
    { file, category, licence }: { file: File; category: string; licence?: LicenceDetails },
    onUploaded: () => void,
  ) => {
    // A driver's licence is saved as the employee's licence (image and details), not as a
    // personal document.
    if (licence) {
      saveLicence(
        { file, details: licence, exists: !!licenceView?.licence },
        {
          onSuccess: () => {
            onUploaded();
            toast.success("Driver's licence saved");
          },
          onError: (err) => toast.error(extractError(err, "Failed to save the driver's licence")),
        },
      );
      return;
    }
    uploadDocument(
      { file, category },
      {
        onSuccess: () => {
          onUploaded();
          setUploadSuccess(true);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to upload document')),
      },
    );
  };

  const handleDelete = (doc: MyDocument) => {
    deleteDocument(doc.id, {
      onSuccess: () => toast.success('Document deleted'),
      onError: (err) => toast.error(extractError(err, 'Failed to delete document')),
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <DocumentFoldersRail
        active={folder}
        onSelect={handleFolderSelect}
        counts={counts}
        collapsed={railCollapsed}
      />
      <DocumentManagerPanel
        key={folder}
        documents={documents}
        isLoading={isLoading}
        // Company documents are HR's, except the employee's own driver's licence.
        allowUpload
        allowDelete={folder === 'personal'}
        onDelete={handleDelete}
        onSelectionChange={(doc) => {
          if (doc) setRailCollapsed(true);
        }}
        renderDetails={(doc) =>
          doc.type === 'DRIVER_LICENCE' ? <DriverLicenceDetails scope={null} /> : null
        }
        renderUploadModal={({ isOpen, onClose }) =>
          folder === 'personal' ? (
            <UploadPersonalDocumentModal
              isOpen={isOpen}
              onClose={onClose}
              isUploading={isUploading || isSavingLicence}
              onUpload={(input) => handleUpload(input, onClose)}
            />
          ) : (
            <UploadCompanyDocumentModal
              isOpen={isOpen}
              onClose={onClose}
              onlyTypes={['DRIVER_LICENCE']}
              isUploading={isSavingLicence}
              onUpload={(input) => {
                if (!input.licence) return;
                saveLicence(
                  { file: input.file, details: input.licence, exists: !!licenceView?.licence },
                  {
                    onSuccess: () => {
                      onClose();
                      toast.success("Driver's licence saved");
                    },
                    onError: (err) =>
                      toast.error(extractError(err, "Failed to save the driver's licence")),
                  },
                );
              }}
            />
          )
        }
      />

      <SuccessModal
        isOpen={uploadSuccess}
        onClose={() => setUploadSuccess(false)}
        title="Document Uploaded!"
        message="Your document has been added to Personal Documents."
      />
    </div>
  );
}
