'use client';

import { Facultative, PlacementEndorsement } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  ClosingLetterContent,
  type ClosingLetterData,
} from '@/components/molecules/documents/content/ClosingLetterContent';

export type { ClosingLetterData };

interface ClosingLetterModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement?: PlacementEndorsement;
  closing: ClosingLetterData | null;
  onClose: () => void;
}

/** Content-only preview of the "Closings" letter, opened from the effective
 *  position table. Renders an original placement closing or, when `endorsement`
 *  is passed, a post-endorsement closing. */
export function ClosingLetterModal({
  isOpen,
  placement,
  endorsement,
  closing,
  onClose,
}: ClosingLetterModalProps) {
  if (!closing) return null;

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Closings — ${displayPolicyNumber(placement.policyNumber)}`}
      fileName={buildDocumentFileName(
        'Closings',
        displayPolicyNumber(placement.policyNumber),
        placement.title,
      )}
      printRootId="closing-letter-print-root"
      onClose={onClose}
    >
      <ClosingLetterContent placement={placement} endorsement={endorsement} closing={closing} />
    </DocumentPreviewShell>
  );
}
