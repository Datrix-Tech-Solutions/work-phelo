'use client';

import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  PaymentReceiptContent,
  type PaymentReceiptContentProps,
} from '@/components/molecules/documents/content/PaymentReceiptContent';

interface PaymentReceiptModalProps extends PaymentReceiptContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the payment receipt, opened from the payment history. */
export function PaymentReceiptModal({ isOpen, onClose, ...content }: PaymentReceiptModalProps) {
  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Payment Receipt — ${displayPolicyNumber(content.placement.policyNumber)}`}
      printRootId="payment-receipt-print-root"
      onClose={onClose}
    >
      <PaymentReceiptContent {...content} />
    </DocumentPreviewShell>
  );
}
