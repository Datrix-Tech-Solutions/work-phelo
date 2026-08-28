'use client';

import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  DebitNoteContent,
  type DebitNoteContentProps,
} from '@/components/molecules/documents/content/DebitNoteContent';

interface DebitNotePreviewModalProps extends DebitNoteContentProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
}

/** Content-only preview of the debit note. */
export function DebitNotePreviewModal({
  isOpen,
  title,
  onClose,
  ...content
}: DebitNotePreviewModalProps) {
  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={title}
      fileName={buildDocumentFileName(
        'Debit Note',
        displayPolicyNumber(content.placement?.policyNumber),
        content.placement?.title,
        content.cedantName ? `to ${content.cedantName}` : null,
      )}
      printRootId="debit-note-print-root"
      onClose={onClose}
    >
      <DebitNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
