'use client';

import { useMemo } from 'react';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { BillDocument } from '@/components/molecules/accounting/documents/BillDocument';
import { InvoiceDocument } from '@/components/molecules/accounting/documents/InvoiceDocument';
import { CreditNoteDocument } from '@/components/molecules/accounting/documents/CreditNoteDocument';
import { DebitNoteDocument } from '@/components/molecules/accounting/documents/DebitNoteDocument';
import {
  accountingDocumentLabel,
  buildTradeDocumentData,
  isAccountingDocumentKey,
  type AccountingDocumentKey,
} from '@/lib/accounting/documents';
import type { AccountingTradeDocument } from '@/types/accounting';

export interface DocumentPreviewTarget {
  document: AccountingTradeDocument;
  documentKey: AccountingDocumentKey;
}

/** Read-only preview of a transaction as the document its Transaction Type allows. Drafts
 *  and reversed transactions carry a watermark so a preview is never mistaken for the
 *  final document. */
export function DocumentPreviewPanel({
  target,
  onClose,
}: {
  target: DocumentPreviewTarget | null;
  onClose: () => void;
}) {
  const data = useMemo(() => (target ? buildTradeDocumentData(target.document) : null), [target]);

  return (
    <SidePanel
      isOpen={target !== null}
      onClose={onClose}
      title={target ? `${accountingDocumentLabel(target.documentKey)} Preview` : 'Document'}
      description={target?.document.documentNumber}
      width="sm:w-[860px]"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {target && data && isAccountingDocumentKey(target.documentKey) && (
        <div className="bg-gray-50 p-2 sm:p-4">
          {target.documentKey === 'BILL' && <BillDocument data={data} />}
          {target.documentKey === 'INVOICE' && <InvoiceDocument data={data} />}
          {target.documentKey === 'CREDIT_NOTE' && <CreditNoteDocument data={data} />}
          {target.documentKey === 'DEBIT_NOTE' && <DebitNoteDocument data={data} />}
        </div>
      )}
    </SidePanel>
  );
}
