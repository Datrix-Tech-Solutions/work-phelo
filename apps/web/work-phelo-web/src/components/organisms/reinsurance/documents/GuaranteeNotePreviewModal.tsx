'use client';

import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  GuaranteeNoteContent,
  type GuaranteeNoteContentProps,
} from '@/components/molecules/documents/content/GuaranteeNoteContent';

interface GuaranteeNotePreviewModalProps extends GuaranteeNoteContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the guarantee note. */
export function GuaranteeNotePreviewModal({
  isOpen,
  onClose,
  ...content
}: GuaranteeNotePreviewModalProps) {
  const policyNumber = content.policyNumberOverride ?? content.placement.policyNumber;

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Guarantee Note — ${displayPolicyNumber(policyNumber)}`}
      printRootId="guarantee-note-print-root"
      onClose={onClose}
    >
      <GuaranteeNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
