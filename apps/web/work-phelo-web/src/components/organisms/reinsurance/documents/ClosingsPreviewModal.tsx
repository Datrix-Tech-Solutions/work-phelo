'use client';

import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  CreditNoteContent,
  type CreditNoteContentProps,
} from '@/components/molecules/documents/content/CreditNoteContent';

interface ClosingsPreviewModalProps extends CreditNoteContentProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
}

/** Content-only preview of the "Closings" credit note. */
export function ClosingsPreviewModal({
  isOpen,
  title,
  onClose,
  ...content
}: ClosingsPreviewModalProps) {
  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={title}
      fileName={buildDocumentFileName(
        'Closings',
        displayPolicyNumber(content.placement?.policyNumber),
        content.placement?.title,
        content.reinsurerCompany ? `to ${content.reinsurerCompany}` : null,
      )}
      printRootId="closings-print-root"
      onClose={onClose}
    >
      <CreditNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
