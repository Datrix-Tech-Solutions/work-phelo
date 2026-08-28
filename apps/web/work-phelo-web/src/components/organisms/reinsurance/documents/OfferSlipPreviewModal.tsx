'use client';

import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  OfferSlipContent,
  type OfferSlipContentProps,
} from '@/components/molecules/documents/content/OfferSlipContent';

interface OfferSlipPreviewModalProps extends OfferSlipContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the facultative offer slip, opened from the
 *  distribution list's "Preview Slip" action. */
export function OfferSlipPreviewModal({ isOpen, onClose, ...content }: OfferSlipPreviewModalProps) {
  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Offer Slip — ${content.placement.title}`}
      fileName={buildDocumentFileName(
        'Offer Slip',
        displayPolicyNumber(content.placement.policyNumber),
        content.placement.title,
      )}
      printRootId="offer-slip-print-root"
      onClose={onClose}
    >
      <OfferSlipContent {...content} />
    </DocumentPreviewShell>
  );
}
