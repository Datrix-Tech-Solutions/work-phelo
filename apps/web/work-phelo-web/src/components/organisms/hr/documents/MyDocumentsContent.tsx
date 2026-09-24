'use client';

import { useMemo, useState } from 'react';
import { DocumentFoldersRail } from '@/components/molecules/hr/documents/DocumentFoldersRail';
import { DocumentManagerPanel } from './DocumentManagerPanel';
import { UploadPersonalDocumentModal } from './UploadPersonalDocumentModal';
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
import type { EmployeeDocument } from '@/types/hr';

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
  };
}

// Personal documents are uploaded here, by the employee. Company documents are
// uploaded from the employee's record by HR (see EmployeeDocumentsTab) — this
// view only lets the employee view/download those, not add or remove them.
export function MyDocumentsContent() {
  const [folder, setFolder] = useState<DocumentFolderKey>('personal');
  const [hasSelection, setHasSelection] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const toast = useToast();

  const handleFolderSelect = (next: DocumentFolderKey) => {
    setFolder(next);
    setHasSelection(false);
  };

  const { data: personalDocsRaw, isLoading: personalLoading } = useMyDocuments();
  const { data: companyDocsRaw, isLoading: companyLoading } = useMyEmployeeDocuments();
  const { mutate: uploadDocument, isPending: isUploading } = useUploadMyDocument();
  const { mutate: deleteDocument } = useDeleteMyDocument();

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
    { file, category }: { file: File; category: string },
    onUploaded: () => void,
  ) => {
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
        collapsed={hasSelection}
      />
      <DocumentManagerPanel
        key={folder}
        documents={documents}
        isLoading={isLoading}
        allowUpload={folder === 'personal'}
        allowDelete={folder === 'personal'}
        onDelete={handleDelete}
        onSelectionChange={(doc) => setHasSelection(doc !== null)}
        renderUploadModal={({ isOpen, onClose }) => (
          <UploadPersonalDocumentModal
            isOpen={isOpen}
            onClose={onClose}
            isUploading={isUploading}
            onUpload={(input) => handleUpload(input, onClose)}
          />
        )}
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
